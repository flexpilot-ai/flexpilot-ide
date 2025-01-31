/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createAzure } from '@ai-sdk/azure';
import { generateText } from 'ai';
import * as vscode from 'vscode';
import { IChatModelProvider, IChatModelProviderResult, IModelConfig } from '../types';
import { corsEnableUrl } from '../utilities';
import { ICustomDialogInputOptions, ICustomDialogOutputResult } from '../../../../src/vscode-dts/flexpilot';
import { DEFAULT_MODEL_PARAMS } from '../constants';
import { modelConfigs } from '../context';

/**
 * Extended interface for Azure OpenAI chat model configuration
 */
export interface IAzureOpenAIChatModelConfig extends IModelConfig {
	baseUrl: string;
	apiKey: string;
	temperature: number;
}

/**
 * Azure OpenAI Chat Model Provider class
 */
export class AzureOpenAIChatModelProvider extends IChatModelProvider {
	static override readonly providerName = 'Azure OpenAI';
	static override readonly providerId = 'azure-openai-chat';

	/**
	 * Configures a new Azure OpenAI model
	 */
	static override readonly configure = async (configId: string): Promise<boolean> => {
		const config = modelConfigs.get<IAzureOpenAIChatModelConfig>(configId);

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
					placeholder: 'e.g., Azure OpenAI Model',
					label: 'Nickname',
					value: config?.nickname
				},
				{
					placeholder: 'e.g., https://{resourceName}.openai.azure.com/openai/deployments/{deploymentId}',
					label: 'API Base URL',
					value: config?.baseUrl
				},
				{
					placeholder: 'e.g., upydshyx1rlleghhe1zw...',
					label: 'API Key',
					value: config?.apiKey,
					type: 'password'
				},
				{
					placeholder: 'e.g., deploymentId',
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
				const provider = createAzure({
					apiKey: apiKey,
					baseURL: baseUrl,
				});
				await generateText({
					prompt: 'Hello',
					maxTokens: 3,
					temperature: parseFloat(temperature),
					model: provider.chat(modelId),
					abortSignal: abortController.signal
				});
			}
		);

		const newConfig: IAzureOpenAIChatModelConfig = {
			// Base model configuration
			family: modelId,
			maxInputTokens: 100000,
			maxOutputTokens: 10000,
			version: modelId,
			nickname,
			modelId,
			supportsToolCalls: !!response.checkboxChecked,
			providerId: AzureOpenAIChatModelProvider.providerId,

			// Provider specific configuration
			baseUrl,
			apiKey,
			temperature: parseFloat(temperature),
		};

		// Save the new configuration
		await modelConfigs.update<IAzureOpenAIChatModelConfig>(configId, newConfig);
		return true;
	};

	/**
	 * Retrieves the chat model and settings for the given configuration ID
	 */
	static override readonly model = (configId: string): IChatModelProviderResult => {
		const config = modelConfigs.get<IAzureOpenAIChatModelConfig>(configId);
		if (!config) {
			throw new Error(`Model configuration not found for ${configId}`);
		}
		return {
			model: createAzure({
				apiKey: config.apiKey,
				baseURL: corsEnableUrl(config.baseUrl),
			}).chat(config.modelId),
			settings: {
				temperature: config.temperature,
			}
		};
	};
}
