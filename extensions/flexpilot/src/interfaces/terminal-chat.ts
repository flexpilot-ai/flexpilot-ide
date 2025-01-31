/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { logger } from '../logger';
import { buildRequest } from '../prompts/terminal-chat';
import { getGitHubSession, parseTokenUsage } from '../utilities';

/**
 * Handles chat requests by preparing and sending messages to the chat model, and processing the response.
 */
const chatRequestHandler: vscode.ChatExtendedRequestHandler = async (request, context, response, token) => {
	try {
		// Build the request messages
		const messages = await buildRequest(response, context, request);
		logger.debug('Request messages for terminal chat: \n\n' + JSON.stringify(messages, null, 2));

		// Check if the user has requested token usage
		const returnTokenUsage = vscode.workspace.getConfiguration().get<boolean>('flexpilot.terminal.showTokenUsage');

		// Generate the chat response
		const { text } = await request.model.sendRequest(messages, { modelOptions: { returnTokenUsage } }, token);
		let responseText: string = '';

		for await (const chunk of text) {
			// Check if the chunk is a text part or token usage part
			const tokenUsage = parseTokenUsage(chunk);
			if (tokenUsage) {
				if (returnTokenUsage) { response.warning(tokenUsage); }
				continue;
			}
			responseText = responseText.concat(chunk);
			response.push(new vscode.ChatResponseMarkdownPart(chunk));
		}

		// Return the metadata for the response
		logger.debug('Response text for terminal chat: \n\n' + responseText);
		return { metadata: { response: responseText, request: request.prompt } };
	} catch (error) {
		// Log and return error details if any
		logger.error(error as Error);
		response.button({ command: 'flexpilot.viewLogs', title: 'View Logs' });
		return {
			metadata: { response: 'Unable to process request', request: request.prompt },
			errorDetails: { message: 'Error processing request' },
		};
	}
};

let chatParticipant: vscode.ChatParticipant | undefined;

/**
 * Registers a new chat participant for the terminal.
 */
export const register = async () => {
	// Dispose of the existing participant if it exists
	if (chatParticipant) { await chatParticipant.dispose(); }

	// Create the chat participant
	chatParticipant = vscode.chat.createChatParticipant('flexpilot.terminal.session', chatRequestHandler);

	// Set up welcome message provider
	chatParticipant.welcomeMessageProvider = {
		provideWelcomeMessage: async () => {
			const message = new vscode.MarkdownString('Welcome to the Flexpilot AI terminal chat!');
			return { icon: new vscode.ThemeIcon('terminal'), title: 'Ask Flexpilot', message };
		}
	};

	// Set up requester information
	chatParticipant.iconPath = new vscode.ThemeIcon('terminal');

	const githubSession = await getGitHubSession();
	const user = githubSession?.account?.label || 'User';
	const accountId = githubSession?.account?.id;
	chatParticipant.requester = {
		name: user,
		icon: accountId ? vscode.Uri.parse(`https://avatars.githubusercontent.com/u/${accountId}`) : undefined,
	};
	logger.info('Terminal chat participant registered');
};

/**
 * Disposes of the disposable resource if it exists.
 */
export const dispose = async () => {
	if (chatParticipant) { await chatParticipant.dispose(); }
};
