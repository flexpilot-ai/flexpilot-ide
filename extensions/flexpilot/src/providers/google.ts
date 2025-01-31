/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import * as vscode from 'vscode';
import { IChatModelProvider, IChatModelProviderResult, IModelConfig } from '../types';
import { corsEnableUrl } from '../utilities';
import { ICustomDialogInputOptions, ICustomDialogOutputResult } from '../../../../src/vscode-dts/flexpilot';
import { DEFAULT_MODEL_PARAMS } from '../constants';
import { modelConfigs } from '../context';

/**
 * Extended interface for Google Generative AI chat model configuration
 */
export interface IGoogleGenerativeAIChatModelConfig extends IModelConfig {
	baseUrl: string;
	apiKey: string;
	temperature: number;
}

/**
 * Google Generative AI Chat Model Provider class
 */
export class GoogleChatModelProvider extends IChatModelProvider {
	static override readonly providerName = 'Google Generative AI';
	static override readonly providerId = 'google-generative-ai';

	/**
	 * Configures a new Google Generative AI model
	 */
	static override readonly configure = async (configId: string): Promise<boolean> => {
		const config = modelConfigs.get<IGoogleGenerativeAIChatModelConfig>(configId);

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
					label: 'Nickname',
					placeholder: 'e.g., Google Generative AI Model',
					value: config?.nickname
				},
				{
					label: 'API Base URL',
					placeholder: 'e.g., https://generativelanguage.googleapis.com/v1beta',
					value: config?.baseUrl || 'https://generativelanguage.googleapis.com/v1beta'
				},
				{
					label: 'API Key',
					placeholder: 'e.g., AIzaSyBkDAJok71t...',
					type: 'password',
					value: config?.apiKey
				},
				{
					label: 'modelId',
					placeholder: 'e.g, models/gemini-1.5-flash',
					value: config?.modelId
				},
				{
					label: 'Temperature',
					placeholder: 'Temperature',
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
			throw new Error('Model Name is required');
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
				const google = createGoogleGenerativeAI({
					apiKey: apiKey,
					baseURL: baseUrl,
				});
				await generateText({
					prompt: 'Hello',
					maxTokens: 3,
					temperature: parseFloat(temperature),
					model: google.chat(modelId),
					abortSignal: abortController.signal
				});
			}
		);

		const newConfig: IGoogleGenerativeAIChatModelConfig = {
			// Base model configuration
			family: modelId,
			maxInputTokens: 100000,
			maxOutputTokens: 10000,
			version: modelId,
			nickname,
			modelId,
			supportsToolCalls: !!response.checkboxChecked,
			providerId: GoogleChatModelProvider.providerId,

			// Provider specific configuration
			baseUrl,
			apiKey,
			temperature: parseFloat(temperature),
		};

		// Save the new configuration
		await modelConfigs.update<IGoogleGenerativeAIChatModelConfig>(configId, newConfig);
		return true;
	};

	/**
	 * Retrieves the chat model and settings for the given configuration ID
	 */
	static override readonly model = (configId: string): IChatModelProviderResult => {
		const config = modelConfigs.get<IGoogleGenerativeAIChatModelConfig>(configId);
		if (!config) {
			throw new Error(`Model configuration not found for ${configId}`);
		}
		return {
			model: createGoogleGenerativeAI({
				apiKey: config.apiKey,
				baseURL: corsEnableUrl(config.baseUrl),
			}).languageModel(config.modelId),
			settings: {
				temperature: config.temperature,
			}
		};
	};
}
