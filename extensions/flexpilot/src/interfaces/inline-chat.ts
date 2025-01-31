/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { logger } from '../logger';
import { buildRequest } from '../prompts/inline-chat';
import { getEol, getGitHubSession, parseTokenUsage } from '../utilities';

/**
 * Handles chat requests by preparing and sending messages to the chat model, and processing the response.
 */
const chatRequestHandler: vscode.ChatExtendedRequestHandler = async (request, context, response, token) => {
	try {
		// Get the active text editor for the request handling
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			throw new Error('No active text editor found for Inline Chat');
		}

		// Get the selected text and its range in the editor
		const selection = editor.document.getText(editor.selection);
		const selectionRange = editor.selection;

		// Get the prefix and suffix spaces of the selection to maintain the formatting
		const prefixSpaces = (selection.match(/^\s*/) || [''])[0];
		const suffixSpaces = (selection.match(/\s*$/) || [''])[0];

		// Prepare messages for the chat
		const messages = await buildRequest(response, context, request, editor);
		logger.debug('Request messages for inline chat: \n\n' + JSON.stringify(messages, null, 2));

		// Check if the user has requested token usage
		const returnTokenUsage = vscode.workspace.getConfiguration().get<boolean>('flexpilot.inlineChat.showTokenUsage');

		// Generate the chat response
		const { text } = await request.model.sendRequest(messages, { modelOptions: { returnTokenUsage } }, token);

		let responseText: string = '';
		let lastPushedIndex = 0;

		// Track the files and text edits that have been pushed to the response
		let markdownPushed = false;

		for await (const chunk of text) {
			// Check if the chunk is a text part or token usage part
			const tokenUsage = parseTokenUsage(chunk);
			if (tokenUsage) {
				if (returnTokenUsage) { response.warning(tokenUsage); }
				continue;
			}

			// append the text part to the final response
			responseText = responseText.concat(chunk);

			const desc = responseText.match(/<change-description>([^]*?)<\/change-description>/);
			// Check if the description and file are present
			if (!desc?.length) { continue; }

			// Push the markdown and code block parts to the response
			if (!markdownPushed) {
				response.markdown(desc[1].trim());
				markdownPushed = true;
			}

			// Check if the code block is present
			if (!responseText.includes('<updated-selection-content>')) { continue; }

			// Get the partial code block from the response text
			const partialCode = responseText.split('<updated-selection-content>')[1].split('</updated-selection-content>')[0].trimStart();
			if (!partialCode) { continue; }

			// get the filtered lines between boundary
			let filtered = (prefixSpaces + partialCode).split('\n');
			if (responseText.includes('</updated-selection-content>')) {
				filtered = (prefixSpaces + partialCode.trim() + suffixSpaces).split('\n');
			}

			// push the filtered lines to the response
			for (let i = lastPushedIndex; i < filtered.length - 1; i++) {
				if (i === 0) {
					// replace the selection with the first line
					response.push(
						new vscode.ChatResponseTextEditPart(editor.document.uri, {
							range: selectionRange,
							newText: filtered[i] + getEol(editor.document),
						}),
					);
				} else {
					// insert the rest of the lines after the first line
					response.push(
						new vscode.ChatResponseTextEditPart(editor.document.uri, {
							range: new vscode.Range(
								selectionRange.start.translate(i),
								selectionRange.start.translate(i),
							),
							newText: filtered[i] + getEol(editor.document),
						}),
					);
				}
				lastPushedIndex = i + 1;
			}
		}

		// Reformatting the generated code to match the original selection
		const fullCode = responseText.split('<updated-selection-content>')[1].split('</updated-selection-content>')[0].trim();
		response.push(
			new vscode.ChatResponseTextEditPart(editor.document.uri, {
				range: selectionRange.with({ end: selectionRange.start.translate(lastPushedIndex) }),
				newText: (prefixSpaces + fullCode.trim() + suffixSpaces),
			}),
		);

		// Log the model response
		logger.debug('Response text for inline chat: \n\n' + responseText);
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
 * Registers a new panel chat participant with the default chat request handler.
 */
export const register = async () => {
	// Dispose of the existing participant if it exists
	if (chatParticipant) { await chatParticipant.dispose(); }

	// Create the chat participant
	chatParticipant = vscode.chat.createChatParticipant('flexpilot.editor.default', chatRequestHandler);

	// Set up requester information
	chatParticipant.iconPath = new vscode.ThemeIcon('copilot');
	const githubSession = await getGitHubSession();
	const user = githubSession?.account?.label || 'User';
	const accountId = githubSession?.account?.id;
	chatParticipant.requester = {
		name: user,
		icon: accountId ? vscode.Uri.parse(`https://avatars.githubusercontent.com/u/${accountId}`) : undefined,
	};
	logger.info('Inline chat participant registered');
};

/**
 * Disposes of the disposable resource if it exists.
 */
export const dispose = async () => {
	if (chatParticipant) { await chatParticipant.dispose(); }
};
