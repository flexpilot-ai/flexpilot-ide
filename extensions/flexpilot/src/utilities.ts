/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ILanguageConfig } from './types';
import { logger } from './logger';
import { globalState } from './context';
import { LANGUAGES } from './constants';

/**
 * Retrieves or creates a GitHub authentication session.
 */
export const getGitHubSession = async (options?: { createIfNone: boolean }): Promise<vscode.AuthenticationSession | undefined> => {
	const session = await vscode.authentication.getSession(
		'github',
		['public_repo', 'user:email'],
		{ createIfNone: !!options?.createIfNone },
	);
	return session;
};

/**
 * Check if there is an update available for the IDE
 */
export const checkUpdateAvailable = async () => {
	try {
		if (process.platform === 'web') { return; }
		const response = await fetch('https://github.com/flexpilot-ai/flexpilot-ide/releases/latest');
		const urlSplits = response.url.split('/');
		if (urlSplits.at(-2) === 'tag' && urlSplits.at(-1) !== vscode.version) {
			logger.notifyInfo('New version of Flexpilot IDE is available. Please update to the latest version for the best experience.');
			logger.info(`Current version: ${vscode.version}, Latest version: ${urlSplits.at(-1)}`);
		}
	} catch (error) {
		logger.warn(`Unable to check for updates: ${error}`);
	}
};

/**
 * Retrieves the Token Usage from the given chunk.
 */
export const parseTokenUsage = (chunk: string): string | undefined => {
	const tokenUsage = chunk.match(/<flexpilot-llm-token-usage>([^]*?)<\/flexpilot-llm-token-usage>/);
	if (tokenUsage) {
		const tokenUsageJson = JSON.parse(tokenUsage[1].trim());
		return [
			`Prompt Tokens: ${tokenUsageJson.promptTokens}`,
			`Completion Tokens: ${tokenUsageJson.completionTokens}`
		].join(', ');
	}
	return undefined;
};

/**
 * Sets a context key with a specified boolean value in the Visual Studio Code environment.
 */
export const setContext = async (key: string, value: boolean) => {
	await vscode.commands.executeCommand('setContext', `flexpilot:${key}`, value);
};

/**
 * Modifies the given URL to route through a CORS proxy.
 */
export const corsEnableUrl = (url: string) => {
	if (process.platform !== 'web') { return url; }
	const baseUrlObject = new URL(url);
	baseUrlObject.protocol = 'https:';
	baseUrlObject.port = '';
	baseUrlObject.pathname = '/' + baseUrlObject.hostname + baseUrlObject.pathname;
	baseUrlObject.hostname = 'cors-proxy.flexpilot.ai';
	return baseUrlObject.toString();
};

/**
 * Retrieves the type of the given terminal based on its shell path.
 */
export const getTerminalType = (terminal?: vscode.Terminal): string => {
	if (
		terminal &&
		'shellPath' in terminal.creationOptions &&
		terminal.creationOptions.shellPath
	) {
		const shellName = terminal.creationOptions.shellPath.replace(/\\/g, '/').split('/').pop();
		switch (true) {
			case shellName === 'bash.exe':
				return 'Git Bash';
			case shellName?.startsWith('pwsh'):
			case shellName?.startsWith('powershell'):
				return 'powershell';
			case Boolean(shellName?.trim()):
				return shellName?.split('.')[0] || 'sh';
		}
	}
	const defaultType = process.platform === 'win32' ? 'powershell' : 'sh';
	return defaultType;
};

/**
 * Retrieves the end-of-line sequence for a given document.
 */
export const getEol = (document: vscode.TextDocument): string => {
	return document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
};

/**
 * Retrieves the language configuration for a given language ID.
 */
export const getLanguageConfig = (languageId: string): ILanguageConfig => {
	if (LANGUAGES[languageId]) {
		return LANGUAGES[languageId];
	} else {
		return { markdown: languageId, comment: { start: '//', end: '' } };
	}
};

/**
 * Triggers user support by starring the specified GitHub repository using the provided authentication session.
 */
export const triggerUserSupport = async (session: vscode.AuthenticationSession) => {
	try {
		await fetch(
			'https://api.github.com/user/starred/flexpilot-ai/flexpilot-ide',
			{
				method: 'PUT',
				headers: {
					Accept: 'application/vnd.github+json',
					'X-GitHub-Api-Version': '2022-11-28',
					Authorization: `Bearer ${session.accessToken}`,
				}
			}
		);
		logger.info('Successfully starred the GitHub repository');
	} catch (error) {
		logger.warn(`Unable to star the GitHub repository: ${error}`);
	}
};

/**
 * Displays a notification prompting the user to support the mission by giving a GitHub star.
 */
export const showSupportNotification = (session: vscode.AuthenticationSession): void => {
	vscode.window
		.showInformationMessage(
			'Support our mission to make AI accessible - give us a GitHub star by just clicking `Yes` button!',
			'Yes (recommended)',
			'No, I don\'t like to support',
		)
		.then(async (support) => {
			if (support === 'Yes (recommended)') {
				// Set the global state to indicate that the user has supported the extension
				globalState.update('github.support', true);

				// Trigger user support and show a follow-up message to become a sponsor
				triggerUserSupport(session).then(() => {
					vscode.window
						.showInformationMessage(
							'Thanks for helping us make AI open and accessible to everyone!',
							'Become a Sponsor',
						)
						.then(async (sponsor) => {
							if (sponsor === 'Become a Sponsor') {
								vscode.env.openExternal(vscode.Uri.parse('https://github.com/sponsors/mohankumarelec'));
							}
						});
				});
			}
		});
};
