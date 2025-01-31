/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createOpenAICompatible } from '@mohankumarelec/openai-compatible';
import { generateText } from 'ai';
import * as vscode from 'vscode';
import { IChatModelProvider, IChatModelProviderResult, IModelConfig } from '../types';
import { corsEnableUrl } from '../utilities';
import { ICustomDialogInputOptions, ICustomDialogOutputResult } from '../../../../src/vscode-dts/flexpilot';
import { DEFAULT_MODEL_PARAMS } from '../constants';
import { modelConfigs } from '../context';

/**
 * Extended interface for OpenAI Compatible chat model configuration
 */
export interface IGenericChatModelConfig extends IModelConfig {
	baseUrl: string;
	apiKey: string;
	temperature: number;
	urlParams?: Record<string, string>;
	headers?: Record<string, string>;
}

/**
 * OpenAI Compatible Chat Model Provider class
 */
export class GenericChatModelProvider extends IChatModelProvider {
	static override providerName = 'OpenAI Compatible';
	static override providerId = 'openai-compatible';

	// Configuration dialog placeholders and labels for OpenAI Compatible models
	static nicknamePlaceholder = 'e.g., GPT-4 OpenAI Model';
	static nicknameLabel = 'Nickname';
	static apiKeyPlaceholder = 'e.g., sk-1234567890abcdef';
	static apiKeyLabel = 'API Key';
	static baseUrlPlaceholder = 'e.g., https://api.openai.com/v1';
	static baseUrlLabel = 'API Base URL';
	static baseUrlDefault = '';
	static modelIdPlaceholder = 'e.g., gpt-4';
	static modelIdLabel = 'Model ID';
	static temperaturePlaceholder = 'e.g., 0.2 (value between 0 and 1)';
	static temperatureLabel = 'Temperature';
	static headersPlaceholder = 'e.g., {"Custom Header": "Value"}';
	static headersLabel = 'Headers (Optional)';
	static urlParamsPlaceholder = 'e.g., {"Custom Parameter": "Value"}';
	static urlParamsLabel = 'URL Parameters (Optional)';

	/**
	 * Configures a new OpenAI Compatible model
	 */
	static override async configure(configId: string): Promise<boolean> {
		const config = modelConfigs.get<IGenericChatModelConfig>(configId);

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
					placeholder: this.nicknamePlaceholder,
					label: this.nicknameLabel,
					value: config?.nickname
				},
				{
					placeholder: this.baseUrlPlaceholder,
					label: this.baseUrlLabel,
					value: config?.baseUrl || this.baseUrlDefault
				},
				{
					placeholder: this.apiKeyPlaceholder,
					label: this.apiKeyLabel,
					value: config?.apiKey,
					type: 'password'
				},
				{
					placeholder: this.modelIdPlaceholder,
					label: this.modelIdLabel,
					value: config?.modelId
				},
				{
					placeholder: this.temperaturePlaceholder,
					label: this.temperatureLabel,
					value: (config?.temperature || DEFAULT_MODEL_PARAMS.temperature).toString()
				},
				{
					placeholder: this.headersPlaceholder,
					label: this.headersLabel,
					value: config?.headers ? JSON.stringify(config.headers) : undefined
				},
				{
					placeholder: this.urlParamsPlaceholder,
					label: this.urlParamsLabel,
					value: config?.urlParams ? JSON.stringify(config.urlParams) : undefined
				},
			],
		};

		const response = await vscode.commands.executeCommand<ICustomDialogOutputResult>(
			'flexpilot.custom.dialog.show', dialogOptions
		);
		if (!response.values || !response.confirmed) {
			// If the dialog was cancelled or closed, return false
			return false;
		}
		const [nickname, baseUrl, apiKey, modelId, temperature, headers, urlParams] = response.values;

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
		if (headers) {
			try {
				JSON.parse(headers);
			} catch (error) {
				throw new Error('Invalid Headers JSON format');
			}
		}
		if (urlParams) {
			try {
				JSON.parse(urlParams);
			} catch (error) {
				throw new Error('Invalid URL Parameters JSON format');
			}
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
				const provider = createOpenAICompatible({
					name: 'Generic OpenAI Compatible Provider',
					apiKey: apiKey,
					baseURL: baseUrl,
					headers: headers ? JSON.parse(headers) : undefined,
					params: urlParams ? JSON.parse(urlParams) : undefined
				});
				await generateText({
					prompt: 'Hello',
					maxTokens: 3,
					temperature: parseFloat(temperature),
					model: provider.chatModel(modelId),
					abortSignal: abortController.signal
				});
			}
		);

		const newConfig: IGenericChatModelConfig = {
			// Base model configuration
			family: modelId,
			maxInputTokens: 100000,
			maxOutputTokens: 10000,
			version: modelId,
			nickname,
			modelId,
			supportsToolCalls: !!response.checkboxChecked,
			providerId: GenericChatModelProvider.providerId,

			// Provider specific configuration
			baseUrl,
			apiKey,
			temperature: parseFloat(temperature),
			urlParams: urlParams ? JSON.parse(urlParams) : undefined,
			headers: headers ? JSON.parse(headers) : undefined
		};

		// Save the new configuration
		await modelConfigs.update<IGenericChatModelConfig>(configId, newConfig);
		return true;
	}

	/**
	 * Retrieves the chat model and settings for the given configuration ID
	 */
	static override model(configId: string): IChatModelProviderResult {
		const config = modelConfigs.get<IGenericChatModelConfig>(configId);
		if (!config) {
			throw new Error(`Model configuration not found for ${configId}`);
		}
		return {
			model: createOpenAICompatible({
				name: 'Generic OpenAI Compatible Provider',
				apiKey: config.apiKey,
				baseURL: corsEnableUrl(config.baseUrl),
				headers: config.headers,
				params: config.urlParams
			}).chatModel(config.modelId),
			settings: {
				temperature: config.temperature,
			}
		};
	}
}
