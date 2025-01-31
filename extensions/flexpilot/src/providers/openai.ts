/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import * as vscode from 'vscode';
import { IChatModelProvider, IChatModelProviderResult, IModelConfig } from '../types';
import { corsEnableUrl } from '../utilities';
import { ICustomDialogInputOptions, ICustomDialogOutputResult } from '../../../../src/vscode-dts/flexpilot';
import { DEFAULT_MODEL_PARAMS } from '../constants';
import { modelConfigs } from '../context';

/**
 * Extended interface for OpenAI chat model configuration
 */
export interface IOpenAIChatModelConfig extends IModelConfig {
	baseUrl: string;
	apiKey: string;
	organization?: string;
	project?: string;
	temperature: number;
}

/**
 * OpenAI Chat Model Provider class
 */
export class OpenAIChatModelProvider extends IChatModelProvider {
	static override readonly providerName = 'OpenAI';
	static override readonly providerId = 'openai-chat';

	/**
	 * Configures a new OpenAI model
	 */
	static override readonly configure = async (configId: string): Promise<boolean> => {
		const config = modelConfigs.get<IOpenAIChatModelConfig>(configId);

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
					placeholder: 'e.g., OpenAI Model',
					label: 'Nickname',
					value: config?.nickname
				},
				{
					placeholder: 'e.g., https://api.openai.com/v1',
					label: 'API Base URL',
					value: config?.baseUrl ?? 'https://api.openai.com/v1'
				},
				{
					placeholder: 'e.g., sk-proj-mFzPtn...',
					label: 'API Key',
					value: config?.apiKey,
					type: 'password'
				},
				{
					placeholder: 'e.g., gpt-4o-mini',
					label: 'Model ID',
					value: config?.modelId
				},
				{
					placeholder: 'e.g., 0.2 (value between 0 and 1)',
					label: 'Temperature',
					value: (config?.temperature || DEFAULT_MODEL_PARAMS.temperature).toString()
				},
				{
					placeholder: 'e.g., org-...',
					label: 'Organization (Optional)',
					value: config?.organization
				},
				{
					placeholder: 'e.g., proj-...',
					label: 'Project (Optional)',
					value: config?.project
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
		const [nickname, baseUrl, apiKey, modelId, temperature, organization, project] = response.values;

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
				const provider = createOpenAI({
					apiKey: apiKey,
					baseURL: baseUrl,
					organization: organization.trim() || undefined,
					project: project.trim() || undefined,
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

		const newConfig: IOpenAIChatModelConfig = {
			// Base model configuration
			family: modelId,
			maxInputTokens: 100000,
			maxOutputTokens: 10000,
			version: modelId,
			nickname,
			modelId,
			supportsToolCalls: !!response.checkboxChecked,
			providerId: OpenAIChatModelProvider.providerId,

			// Provider specific configuration
			baseUrl,
			apiKey,
			organization: organization.trim() || undefined,
			project: project.trim() || undefined,
			temperature: parseFloat(temperature),
		};

		// Save the new configuration
		await modelConfigs.update<IOpenAIChatModelConfig>(configId, newConfig);
		return true;
	};

	/**
	 * Retrieves the chat model and settings for the given configuration ID
	 */
	static override readonly model = (configId: string): IChatModelProviderResult => {
		const config = modelConfigs.get<IOpenAIChatModelConfig>(configId);
		if (!config) {
			throw new Error(`Model configuration not found for ${configId}`);
		}
		return {
			model: createOpenAI({
				apiKey: config.apiKey,
				baseURL: corsEnableUrl(config.baseUrl),
				organization: config.organization,
				project: config.project,
			}).languageModel(config.modelId),
			settings: {
				temperature: config.temperature,
			}
		};
	};
}
