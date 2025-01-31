/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { logger } from '../logger';
import { buildRequest } from '../prompts/rename-symbol';
import { usagePreferences } from '../context';

/**
 * Handles chat requests by preparing and sending messages to the chat model, and processing the response.
 */
const chatRequestHandler = async (document: vscode.TextDocument, range: vscode.Range, token: vscode.CancellationToken): Promise<vscode.NewSymbolName[]> => {
	try {
		// Build the request messages
		const messages = await buildRequest(document, range);
		logger.debug('Request messages for rename symbol: \n\n' + JSON.stringify(messages, null, 2));

		// Check if there is a model configured for the `Rename Symbol` preference
		const modelId = usagePreferences.get('preference.rename-symbol');
		if (!modelId) { return []; }

		// Get the chat model for the given model ID
		const [model] = await vscode.lm.selectChatModels({ id: modelId });
		if (!model) {
			logger.notifyError('Model not configured for `Rename Symbol`');
			return [];
		}

		// Send the request messages to the chat model and get the response
		const responseText = await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Flexpilot',
				cancellable: false,
			},
			async (progress) => {
				progress.report({ message: 'Generating new symbol names' });
				const { text } = await model.sendRequest(messages, {}, token);
				let responseText: string = '';
				for await (const chunk of text) { responseText += chunk; }
				return responseText;
			},
		);

		// Parse the response text to get the new symbol names
		const matches = Array.from(
			responseText.matchAll(/<symbol-name>(.*?)<\/symbol-name>/g),
			match => match[1]
		);

		// Return the new symbol names
		logger.debug('Response text for rename symbol: \n\n' + responseText);
		return matches.map(value => new vscode.NewSymbolName(value, [vscode.NewSymbolNameTag.AIGenerated]));
	} catch (error) {
		// Log and notify the error if it occurs
		logger.notifyError(String(error), error);
		return [];
	}
};

let newSymbolNamesProvider: vscode.Disposable | undefined;

/**
 * Registers a new panel chat participant.
 */
export const register = async () => {
	// Dispose of the existing participant if it exists
	if (newSymbolNamesProvider) { await newSymbolNamesProvider.dispose(); }

	// Create the chat participant
	newSymbolNamesProvider = vscode.languages.registerNewSymbolNamesProvider('*', {
		supportsAutomaticTriggerKind: Promise.resolve(true),
		provideNewSymbolNames: async (document, range, _triggerKind, token) => {
			return await chatRequestHandler(document, range, token);
		},
	});
	logger.info('Renaming symbol participant registered');
};

/**
 * Disposes of the disposable resource if it exists.
 */
export const dispose = async () => {
	if (newSymbolNamesProvider) { await newSymbolNamesProvider.dispose(); }
};
