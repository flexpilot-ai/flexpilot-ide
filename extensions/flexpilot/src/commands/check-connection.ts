/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { logger } from '../logger';
import { registerDisposable, globalState, modelConfigs, usagePreferences, clearGlobalState } from '../context';
import { modelProviderManager } from '../providers';
import { corsEnableUrl, getGitHubSession, setContext, showSupportNotification, triggerUserSupport } from '../utilities';
import { register as panelChatRegister, dispose as panelChatDispose } from '../interfaces/panel-chat';
import { register as inlineChatRegister, dispose as inlineChatDispose } from '../interfaces/inline-chat';
import { register as renameSymbolRegister, dispose as renameSymbolDispose } from '../interfaces/rename-symbol';
import { register as editingSessionRegister, dispose as editingSessionDispose } from '../interfaces/editing-session';
import { register as terminalChatRegister, dispose as terminalChatDispose } from '../interfaces/terminal-chat';
import { register as completionsRegister, dispose as completionsDispose } from '../interfaces/inline-completion';
import { GenericChatModelProvider, IGenericChatModelConfig } from '../providers/generic';
import { DEFAULT_MODEL_PARAMS, LOCATIONS } from '../constants';
import { IGitHubCopilotModel } from '../types';

// Flag to check if the agents are activated
let isAgentsActivated = false;

/**
 * Registers GitHub models with the provided authentication session.
 */
const registerGitHubModels = async (session: vscode.AuthenticationSession) => {
	const modelsToRegister = { 'gpt-4o': 'GitHub: GPT-4o', 'gpt-4o-mini': 'GitHub: GPT-4o Mini' };
	for (const [modelId, name] of Object.entries(modelsToRegister)) {
		const configId = `gh-models-${modelId}`;
		const newConfig: IGenericChatModelConfig = {
			// Base model configuration
			family: modelId,
			maxInputTokens: 100000,
			maxOutputTokens: 10000,
			version: modelId,
			nickname: name,
			modelId,
			supportsToolCalls: true,
			providerId: GenericChatModelProvider.providerId,

			// Provider specific configuration
			baseUrl: 'https://models.inference.ai.azure.com',
			apiKey: session.accessToken,
			urlParams: { 'api-version': '2024-10-21' },
			temperature: DEFAULT_MODEL_PARAMS.temperature,
		};
		await modelConfigs.update(configId, newConfig);
	}

	// Set the default model for each location if it's not set
	for (const location of LOCATIONS) {
		const modelId = usagePreferences.get(`preference.${location.id}`);
		if (!modelId) {
			await usagePreferences.update(`preference.${location.id}`, `gh-models-gpt-4o-mini`);
		}
	}
};

/**
 * Registers GitHub Copilot models with the provided authentication session.
 */
const registerGithubCopilotModels = async (session: vscode.AuthenticationSession) => {
	// Fetch the GitHub Copilot models from the API and register them with the extension
	const models = await fetch(corsEnableUrl('https://api.githubcopilot.com/models'), {
		headers: { Authorization: `Bearer ${session.accessToken}` }
	});
	if (models.status >= 300) {
		logger.warn('Failed to fetch GitHub Copilot models, ' + await models.text());
		return;
	}
	const modelsResponse: { data: IGitHubCopilotModel[] } = await models.json();

	// Register the models that are enabled for chat and the ones that are whitelisted
	const modelsToRegister = ['gpt-4o-mini'];
	for (const model of modelsResponse.data) {
		if (model.capabilities.type !== 'chat') {
			continue;
		} else if (!model.model_picker_enabled && !modelsToRegister.includes(model.id)) {
			continue;
		}
		const newConfig: IGenericChatModelConfig = {
			// Base model configuration
			family: model.capabilities.family,
			maxInputTokens: model.capabilities.limits.max_prompt_tokens,
			maxOutputTokens: model.capabilities.limits.max_output_tokens,
			version: model.version,
			nickname: `Copilot: ${model.name}`,
			modelId: model.id,
			supportsToolCalls: model.capabilities.supports.tool_calls,
			providerId: GenericChatModelProvider.providerId,

			// Provider specific configuration
			baseUrl: 'https://api.githubcopilot.com',
			apiKey: session.accessToken,
			temperature: DEFAULT_MODEL_PARAMS.temperature,
		};
		await modelConfigs.update(model.id, newConfig);
	}

	// Set the default model for each location if it's not set
	for (const location of LOCATIONS) {
		const modelId = usagePreferences.get(`preference.${location.id}`);
		if (!modelId) {
			await usagePreferences.update(`preference.${location.id}`, 'gpt-4o-mini');
		}
	}
};

/**
 * Checks the internet connection by making a HEAD request to a known URL.
 */
const checkInternetConnection = async () => {
	try {
		await fetch(corsEnableUrl('https://flexpilot.ai'), { method: 'HEAD' });
		return true;
	} catch (error) {
		logger.error(error);
		return false;
	}
};

/**
 * Handles the internet connection check for the Flexpilot extension.
 */
const handler = async () => {
	// Get the GitHub session when there's an active network connection
	const githubSession = await getGitHubSession();

	// Set the logged-in status based on the session
	await setContext('isLoggedIn', !!githubSession);

	if (githubSession && !isAgentsActivated) {
		// Set the flag to true when there's an active session
		isAgentsActivated = true;

		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Flexpilot',
			cancellable: true,
		}, async (progress, _) => {

			// Check the internet connection and set the network connection status
			progress.report({ message: 'Checking internet connection' });
			const isConnected = await checkInternetConnection();
			await setContext('isNetworkConnected', isConnected);

			// Show an error message when there's no internet connection
			if (!isConnected) {
				vscode.window.showErrorMessage(
					'Flexpilot: No internet connection', { modal: true }, 'Retry'
				).then((selection) => {
					if (selection === 'Retry') {
						vscode.commands.executeCommand('flexpilot.checkInternetConnection');
					}
				});
				isAgentsActivated = false;
				return;
			}

			// Register the session features when there's an active session
			if (globalState.get('github.support')) {
				triggerUserSupport(githubSession);
			} else {
				showSupportNotification(githubSession);
			}

			// Register the GitHub models
			progress.report({ message: 'Registering Copilot models' });
			await registerGithubCopilotModels(githubSession);
			progress.report({ message: 'Registering GitHub models' });
			await registerGitHubModels(githubSession);

			// Register the chat panels when there's an active session
			progress.report({ message: 'Registering Chat Participants' });
			await modelProviderManager.initialize();
			await completionsRegister();
			await panelChatRegister();
			await inlineChatRegister();
			await renameSymbolRegister();
			await editingSessionRegister();
			await terminalChatRegister();
		});
	} else if (!githubSession && isAgentsActivated) {
		// Set the flag to false when there's no active session
		isAgentsActivated = false;

		// Dispose the chat panels when there's no active session
		await modelProviderManager.disposeAll();
		await completionsDispose();
		await panelChatDispose();
		await inlineChatDispose();
		await renameSymbolDispose();
		await editingSessionDispose();
		await terminalChatDispose();

		// Clear the global state when there's no active session
		await clearGlobalState();

		// Show a sign-in prompt when there's no active session
		vscode.window
			.showInformationMessage(
				'Please sign in to your GitHub account to start using Flexpilot',
				'Sign in to Chat',
			)
			.then((selection) => {
				if (selection === 'Sign in to Chat') {
					vscode.commands.executeCommand('flexpilot.github.signin');
				}
			});
	}
};

/**
 * Registers the internet connection check command for the Flexpilot extension.
 */
export const registerCheckInternetConnectionCommand = () => {
	registerDisposable(vscode.commands.registerCommand('flexpilot.checkInternetConnection', handler));
	registerDisposable(vscode.authentication.onDidChangeSessions(handler));
	logger.info('Command `flexpilot.checkInternetConnection` registered');
};
