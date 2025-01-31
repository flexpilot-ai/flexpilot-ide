/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IModelConfig } from '../types';
import { logger } from '../logger';
import { modelProviderManager, ModelProviders } from '../providers';
import { globalState, modelConfigs, registerDisposable } from '../context';
import { ICustomDialogInputOptions, ICustomDialogOutputResult } from '../../../../src/vscode-dts/flexpilot';
import OpenAI from 'openai';
import { corsEnableUrl } from '../utilities';

/**
 * Interface for quick pick items.
 */
interface IQuickPickItem extends vscode.QuickPickItem {
	configId?: string;
	provider?: typeof ModelProviders[number];
}

/**
 * Edits the configuration for the selected model provider.
 */
const editConfiguration = async (item: IQuickPickItem): Promise<void> => {
	// Get the configuration ID for the selected model provider
	const configId = item.configId;
	if (!configId) {
		logger.warn('Configuration not found');
		return;
	}
	if (!item.provider) {
		logger.warn('Provider class not found');
		return;
	}

	// Configure the model provider with the existing configuration ID
	item.provider.configure(configId)
		.then(async (status) => {
			if (!status) { return; }
			await modelProviderManager.register(configId);
			logger.notifyInfo('Updated model configuration Successfully');
		})
		.catch((error) => logger.notifyError(String(error), error));
};

/**
 * Adds a new configuration for the selected model provider.
 */
const addNewConfiguration = async (): Promise<void> => {
	// Show the quick pick to select the model provider
	const provider = await vscode.window.showQuickPick(
		ModelProviders.map((provider) => {
			return {
				label: provider.providerName,
				class: provider,
			};
		}), {
		placeHolder: 'Select a chat model provider',
		ignoreFocusOut: true,
		title: 'Flexpilot: Select the chat model provider',
	}
	);
	if (!provider) { return; }

	// Generate a unique configuration ID
	const configId = Date.now().toString();

	// Configure the model provider with the new configuration ID
	provider.class.configure(configId)
		.then(async (status) => {
			if (!status) { return; }
			await modelProviderManager.register(configId);
			logger.notifyInfo('Saved model configuration Successfully');
		})
		.catch((error) => logger.notifyError(String(error), error));
};

/**
 * Deletes the configuration for the selected model provider.
 */
const deleteConfirmationDialog = async (configId: string): Promise<void> => {
	const config = modelConfigs.get<IModelConfig>(configId);
	if (!config) {
		logger.warn(`Configuration not found: ${configId}`);
		return;
	}

	// Show the input box to confirm the deletion of the configuration
	const confirmNickname = await vscode.window.showInputBox({
		title: 'Flexpilot: Delete language model provider',
		ignoreFocusOut: true,
		prompt: 'Enter nickname here to confirm',
		validateInput(value) {
			return value === config.nickname
				? undefined
				: `Text does not match with \`${config.nickname}\``;
		},
		placeHolder: `Enter \`${config.nickname}\` to confirm deletion`,
	});

	// Delete the configuration if the nickname matches the configuration nickname
	if (confirmNickname === config.nickname) {
		modelConfigs.update(configId, undefined);
		await modelProviderManager.dispose(configId);
		logger.notifyInfo(`Deleted model configuration: \`${config.nickname}\``);
	}
};

/**
 * Edits the completions configuration for the default completions model provider.
 */
const completionsConfiguration = async (): Promise<void> => {
	try {
		const config = globalState.get('completions.config');

		// Show the dialog to edit the completions configuration
		const dialogOptions: ICustomDialogInputOptions = {
			primaryButton: 'Save',
			type: 'info',
			message: 'Completions Configuration',
			detail: 'NOTE: Only OpenAI compatabile LLM providers are supported',
			custom: { dialogId: 'flexpilot-model-config' },
			inputs: [
				{
					placeholder: 'e.g., https://codestral.mistral.ai/v1/fim',
					value: config?.baseUrl,
					label: 'API Base URL'
				},
				{
					placeholder: 'e.g., vgAcnlKOXdklg2AWLUv...',
					value: config?.apiKey,
					type: 'password',
					label: 'API Key',
				},
				{
					label: 'Model ID',
					value: config?.modelId,
					placeholder: 'e.g., codestral-latest'
				},
				{
					placeholder: '(NOTE: 4 characters = 1 token) e.g., 500',
					value: (config?.maxOutputTokens || '').toString(),
					label: 'Max Model Output Tokens'
				},
				{
					placeholder: '(NOTE: 4 characters = 1 token) e.g., 4000',
					value: (config?.maxInputTokens || '').toString(),
					label: 'Max Model Input Tokens'
				},
				{
					placeholder: 'e.g., 0.2',
					value: (config?.temperature || '').toString(),
					label: 'Temperature'
				},
				{
					placeholder: 'e.g., 200',
					value: (config?.debouncerWait || '').toString(),
					label: 'Debouncer Wait (ms)'
				},
			],
		};

		const response = await vscode.commands.executeCommand<ICustomDialogOutputResult>(
			'flexpilot.custom.dialog.show', dialogOptions);

		if (!response.values || !response.confirmed) {
			return;
		}

		const [baseUrl, apiKey, modelId, maxOutputTokens, maxInputTokens, temperature, debouncerWait] = response.values;

		// Validate the input values before saving the configuration
		if (!baseUrl || !baseUrl.trim().length) {
			throw new Error('API Base URL is required');
		}
		if (!apiKey || !apiKey.trim().length) {
			throw new Error('API Key is required');
		}
		if (!modelId || !modelId.trim().length) {
			throw new Error('Model ID is required');
		}
		if (!maxOutputTokens || !maxOutputTokens.trim().length || isNaN(parseInt(maxOutputTokens))) {
			throw new Error('Max Model Output Tokens is required and must be a number');
		}
		if (!maxInputTokens || !maxInputTokens.trim().length || isNaN(parseInt(maxInputTokens))) {
			throw new Error('Max Model Input Tokens is required and must be a number');
		}
		if (!temperature || !temperature.trim().length || isNaN(parseFloat(temperature))) {
			throw new Error('Temperature is required and must be a number');
		}
		if (!debouncerWait || !debouncerWait.trim().length || isNaN(parseInt(debouncerWait))) {
			throw new Error('Debouncer Wait is required and must be a number');
		}

		// Test the connection credentials before saving the configuration
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Flexpilot',
				cancellable: true,
			},
			async (progress) => {
				progress.report({ message: 'Testing connection credentials' });
				const openai = new OpenAI({
					apiKey: apiKey,
					baseURL: corsEnableUrl(baseUrl)
				});
				await openai.completions.create({
					max_tokens: 10,
					model: modelId,
					temperature: parseFloat(temperature),
					prompt: 'How',
					suffix: 'doing?',
				});
			}
		);

		// Enable the completions provider
		await globalState.update('completions.disabled', false);

		// Save the completions configuration
		await globalState.update('completions.config', {
			baseUrl,
			apiKey,
			modelId,
			maxOutputTokens: parseInt(maxOutputTokens),
			maxInputTokens: parseInt(maxInputTokens),
			temperature: parseFloat(temperature),
			debouncerWait: parseInt(debouncerWait),
		});
		logger.notifyInfo('Completions configuration saved successfully');
	}
	catch (error) {
		logger.notifyError(String(error), error);
	}
};

/**
 * Handles the configuration process for the Flexpilot extension.
 */
const handler = async () => {
	const quickPickItems: IQuickPickItem[] = [
		{
			label: 'Configurations',
			kind: vscode.QuickPickItemKind.Separator,
		},
		{
			label: 'Menu Options',
			kind: vscode.QuickPickItemKind.Separator
		},
		{
			label: 'Add Chat Model Config',
			detail: 'Add a new chat model configuration',
		},
		{
			label: 'Edit Completions Config',
			detail: 'Edit the completions configuration',
		},
		{
			label: 'Edit Usage Preferences',
			detail: 'Edit the model usage preferences',
		},
	];

	// Get and iterate over the registered chat models
	const chatModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });

	for (const chatModel of chatModels) {

		// Get the configuration for the chat model
		const config = modelConfigs.get<IModelConfig>(chatModel.id);
		if (!config) {
			logger.warn(`Configuration not found: ${chatModel.id}`);
			continue;
		}

		// Get the provider for the chat model
		const provider = ModelProviders.find((item) => item.providerId === config.providerId);
		if (!provider) {
			logger.warn(`ModelProvider not found: ${chatModel.id}`);
			continue;
		}

		// Add the buttons to the quick pick items
		quickPickItems.splice(1, 0, {
			detail: `${chatModel.family}`,
			buttons: [
				{
					iconPath: new vscode.ThemeIcon('gear'),
					tooltip: 'Configure',
				},
				{
					iconPath: new vscode.ThemeIcon('trash'),
					tooltip: 'Delete',
				},
			],
			provider: provider,
			configId: chatModel.id,
			label: chatModel.name,
			alwaysShow: true,
			description: `(${provider.providerName})`,
		});
	}

	// Create a quick pick to select the model provider
	const quickPick = vscode.window.createQuickPick<IQuickPickItem>();
	quickPick.items = quickPickItems;
	quickPick.title = 'Flexpilot: Configure the Language Model Provider';
	quickPick.ignoreFocusOut = true;
	quickPick.canSelectMany = false;
	quickPick.placeholder = 'Select or Edit a language model provider';

	// Handle the button click events
	quickPick.onDidTriggerItemButton(async (event) => {
		quickPick.hide();
		if (event.button.tooltip === 'Configure') {
			editConfiguration(event.item);
		} else if (event.button.tooltip === 'Delete' && event.item.configId) {
			deleteConfirmationDialog(event.item.configId);
		}
	});

	// Handle the selection change event
	quickPick.onDidChangeSelection(async (selection) => {
		quickPick.hide();
		if (selection[0].label === 'Add Chat Model Config') {
			addNewConfiguration();
		} else if (selection[0].label === 'Edit Completions Config') {
			completionsConfiguration();
		} else if (selection[0].label === 'Edit Usage Preferences') {
			vscode.commands.executeCommand('flexpilot.usagePreferences');
		} else {
			editConfiguration(selection[0]);
		}
	});

	// Dispose the quick pick on hide
	quickPick.onDidHide(() => quickPick.dispose());

	// Show the quick pick
	quickPick.show();
};

/**
 * Registers the 'flexpilot.configureModel' command with the Visual Studio Code extension context.
 */
export const registerConfigureModelCommand = () => {
	registerDisposable(vscode.commands.registerCommand('flexpilot.configureModel', handler));
	logger.info('Command `flexpilot.configureModel` registered');
};
