/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import * as vscode from 'vscode';
import { IChatModelProvider, IChatModelProviderResult, IModelConfig } from '../types';
import { corsEnableUrl } from '../utilities';
import { ICustomDialogInputOptions, ICustomDialogOutputResult } from '../../../../src/vscode-dts/flexpilot';
import { DEFAULT_MODEL_PARAMS } from '../constants';
import { modelConfigs } from '../context';

/**
 * Extended interface for GroqCloud chat model configuration
 */
export interface IGroqCloudChatModelConfig extends IModelConfig {
	baseUrl: string;
	apiKey: string;
	temperature: number;
}

/**
 * GroqCloud Chat Model Provider class
 */
export class GroqCloudChatModelProvider extends IChatModelProvider {
	static override readonly providerName = 'GroqCloud';
	static override readonly providerId = 'groqcloud-chat';

	/**
	 * Configures a new GroqCloud model
	 */
	static override readonly configure = async (configId: string): Promise<boolean> => {
		const config = modelConfigs.get<IGroqCloudChatModelConfig>(configId);

		// Show a custom dialog to configure the model settings
		const dialogOptions: ICustomDialogInputOptions = {
			primaryButton: 'Save',
			type: 'info',
			message: 'Model Configuration',
			custom: { dialogId: 'flexpilot-model-config' },
			checkbox: {
				label: 'Supports tool calling',
				checked: !!config?.supportsToolCalls,
			},
			inputs: [
				{
					placeholder: 'e.g., GroqCloud Model',
					label: 'Nickname',
					value: config?.nickname
				},
				{
					placeholder: 'e.g., https://api.groq.com/openai/v1',
					label: 'API Base URL',
					value: config?.baseUrl ?? 'https://api.groq.com/openai/v1'
				},
				{
					placeholder: 'e.g., gsk_vgAcnlKOXdklg2AWLUv...',
					label: 'API Key',
					value: config?.apiKey,
					type: 'password'
				},
				{
					placeholder: 'e.g., llama-3.3-70b-versatile',
					label: 'Model ID',
					value: config?.modelId
				},
				{
					placeholder: 'e.g., 0.2 (value between 0 and 1)',
					label: 'Temperature',
					value: (config?.temperature || DEFAULT_MODEL_PARAMS.temperature).toString()
				}
			],
		};

		const response = await vscode.commands.executeCommand<ICustomDialogOutputResult>(
			'flexpilot.custom.dialog.show', dialogOptions
		);
		if (!response.values || !response.confirmed) {
			// If the dialog was cancelled or closed, return false
			return false;
		}
		const [nickname, baseUrl, apiKey, modelId, temperature] = response.values;

		// Validate the input values before saving the configuration
		if (!nickname || !nickname.length) {
			throw new Error('Nickname is required');
		}
		if (!baseUrl || !baseUrl.length) {
			throw new Error('Base URL is required');
		}
		if (!apiKey || !apiKey.length) {
			throw new Error('API Key is required');
		}
		if (!modelId || !modelId.length) {
			throw new Error('Model ID is required');
		}
		if (!temperature || !temperature.length || isNaN(parseFloat(temperature))) {
			throw new Error('Temperature is required and must be a valid number');
		}

		// Test the connection credentials before saving the configuration
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Flexpilot',
				cancellable: true,
			},
			async (progress, token) => {
				const abortController = new AbortController();
				token.onCancellationRequested(() => abortController.abort());
				progress.report({ message: 'Testing connection credentials' });
				const provider = createGroq({
					apiKey: apiKey,
					baseURL: baseUrl,
				});
				await generateText({
					prompt: 'Hello',
					maxTokens: 3,
					temperature: parseFloat(temperature),
					model: provider.languageModel(modelId),
					abortSignal: abortController.signal
				});
			}
		);

		const newConfig: IGroqCloudChatModelConfig = {
			// Base model configuration
			family: modelId,
			maxInputTokens: 100000,
			maxOutputTokens: 10000,
			version: modelId,
			nickname,
			modelId,
			supportsToolCalls: !!response.checkboxChecked,
			providerId: GroqCloudChatModelProvider.providerId,

			// Provider specific configuration
			baseUrl,
			apiKey,
			temperature: parseFloat(temperature),
		};

		// Save the new configuration
		await modelConfigs.update<IGroqCloudChatModelConfig>(configId, newConfig);
		return true;
	};

	/**
	 * Retrieves the chat model and settings for the given configuration ID
	 */
	static override readonly model = (configId: string): IChatModelProviderResult => {
		const config = modelConfigs.get<IGroqCloudChatModelConfig>(configId);
		if (!config) {
			throw new Error(`Model configuration not found for ${configId}`);
		}
		return {
			model: createGroq({
				apiKey: config.apiKey,
				baseURL: corsEnableUrl(config.baseUrl),
			}).languageModel(config.modelId),
			settings: {
				temperature: config.temperature,
			}
		};
	};
}
