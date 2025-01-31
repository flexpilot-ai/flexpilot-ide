/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import * as vscode from 'vscode';
import { IChatModelProvider, IChatModelProviderResult, IModelConfig } from '../types';
import { ICustomDialogInputOptions, ICustomDialogOutputResult } from '../../../../src/vscode-dts/flexpilot';
import { DEFAULT_MODEL_PARAMS } from '../constants';
import { modelConfigs } from '../context';
import { generateText } from 'ai';

/**
 * Extended interface for Amazon Bedrock chat model configuration
 */
export interface IAmazonBedrockChatModelConfig extends IModelConfig {
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	sessionToken?: string;
	temperature: number;
}

/**
 * Amazon Bedrock Chat Model Provider class
 */
export class AmazonBedrockChatModelProvider extends IChatModelProvider {
	static override readonly providerName = 'Amazon Bedrock';
	static override readonly providerId = 'amazon-bedrock-chat';

	/**
	 * Configures a new Amazon Bedrock model
	 */
	static override readonly configure = async (configId: string): Promise<boolean> => {
		const config = modelConfigs.get<IAmazonBedrockChatModelConfig>(configId);

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
					placeholder: 'e.g., Amazon Bedrock Model',
					label: 'Nickname',
					value: config?.nickname
				},
				{
					placeholder: 'e.g., us-east-2',
					label: 'Region',
					value: config?.region
				},
				{
					placeholder: 'e.g., AKIA...',
					label: 'Access Key ID',
					value: config?.accessKeyId,
				},
				{
					placeholder: 'e.g., xxxxxxxx',
					label: 'Secret Access Key',
					value: config?.secretAccessKey,
					type: 'password'
				},
				{
					placeholder: 'e.g., xxxxxxxx',
					label: 'Session Token (Optional)',
					value: config?.sessionToken,
					type: 'password'
				},
				{
					placeholder: 'e.g., anthropic.claude-3-sonnet-20240229-v1:0',
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
		const [nickname, region, accessKeyId, secretAccessKey, sessionToken, modelId, temperature] = response.values;

		// Validate the input values before saving the configuration
		if (!nickname || !nickname.length) {
			throw new Error('Nickname is required');
		}
		if (!region || !region.length) {
			throw new Error('Region is required');
		}
		if (!accessKeyId || !accessKeyId.length) {
			throw new Error('Access Key ID is required');
		}
		if (!modelId || !modelId.length) {
			throw new Error('Model ID is required');
		}
		if (!secretAccessKey || !secretAccessKey.length) {
			throw new Error('Secret Access Key is required');
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
				const provider = createAmazonBedrock({
					region,
					accessKeyId,
					secretAccessKey,
					sessionToken: sessionToken.trim() || undefined,
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

		const newConfig: IAmazonBedrockChatModelConfig = {
			// Base model configuration
			family: modelId,
			maxInputTokens: 100000,
			maxOutputTokens: 10000,
			version: modelId,
			nickname,
			modelId,
			supportsToolCalls: !!response.checkboxChecked,
			providerId: AmazonBedrockChatModelProvider.providerId,

			// Provider specific configuration
			region,
			accessKeyId,
			secretAccessKey,
			sessionToken: sessionToken.trim() || undefined,
			temperature: parseFloat(temperature),
		};

		// Save the new configuration
		await modelConfigs.update<IAmazonBedrockChatModelConfig>(configId, newConfig);
		return true;
	};

	/**
	 * Retrieves the chat model and settings for the given configuration ID
	 */
	static override readonly model = (configId: string): IChatModelProviderResult => {
		const config = modelConfigs.get<IAmazonBedrockChatModelConfig>(configId);
		if (!config) {
			throw new Error(`Model configuration not found for ${configId}`);
		}
		return {
			model: createAmazonBedrock({
				region: config.region,
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
				sessionToken: config.sessionToken,
			}).languageModel(config.modelId),
			settings: {
				temperature: config.temperature,
			}
		};
	};
}
