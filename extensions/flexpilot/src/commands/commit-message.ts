/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { logger } from '../logger';
import { GitExtension } from '../../../../extensions/git/src/api/git';
import { usagePreferences, registerDisposable } from '../context';
import { buildRequest } from '../prompts/git-message';

/**
 * Handles the generation of a commit message for a given Git repository.
 */
const handler = async (repositoryUri: vscode.Uri, _ISCMInputValueProviderContext: unknown, token: vscode.CancellationToken) => {
	try {
		await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.SourceControl },
			async () => {
				// Get the model provider for the commit message
				const modelId = usagePreferences.get('preference.commit-message');
				if (!modelId) {
					logger.notifyError('Model not configured for `Commit Message`');
					return;
				}

				// Get the Git repository
				const gitExtension =
					vscode.extensions.getExtension<GitExtension>('vscode.git');
				if (!gitExtension) {
					throw new Error('Git extension is not installed or enabled.');
				}

				// Get the repository from the Git extension
				const repository = gitExtension.exports
					.getAPI(1)
					.getRepository(repositoryUri);
				if (!repository) {
					throw new Error(`Git Repository not found at ${repositoryUri}`);
				}

				// Prepare prompts for the chat
				const messages = await buildRequest(repository);
				if (!messages) { return; }

				// Get the chat model for the followup
				const [chatModel] = await vscode.lm.selectChatModels({ id: modelId });
				if (!chatModel) {
					logger.notifyError('Model not configured for `Commit Message`');
					return;
				}

				// Generate the chat response
				const { text } = await chatModel.sendRequest(messages, {}, token);
				let responseText: string = '';
				for await (const chunk of text) {
					responseText = responseText.concat(chunk);
				}

				// Check if the commit message is present in the response
				const commitMessage = responseText.match(/<git-commit-message>([^]*?)<\/git-commit-message>/);
				if (!commitMessage?.length) {
					throw new Error('Model did not return a valid commit message');
				}

				// Set the commit message in the input box
				repository.inputBox.value = commitMessage[1].trim() || 'Sorry, I could not generate a commit message for you.';
			},
		);
	} catch (error) {
		logger.notifyError('Error processing `Commit Message` request', error);
	}
};

/**
 * Registers the `flexpilot.git.generateCommitMessage` command with the Visual Studio Code extension context.
 */
export const registerCommitMessageCommand = () => {
	registerDisposable(vscode.commands.registerCommand('flexpilot.git.generateCommitMessage', handler));
	logger.info('Command `flexpilot.git.generateCommitMessage` registered');
};
