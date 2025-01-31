/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { logger } from '../logger';
import { globalState, registerDisposable } from '../context';
import { getGitHubSession } from '../utilities';

/**
 * Handles the GitHub sign-in process for the Flexpilot extension.
 */
const handler = async () => {
	// Check if the user has already accepted GitHub support
	if (!globalState.get('github.support')) {
		const selectedOption = await vscode.window.showInformationMessage(
			'Flexpilot: Support Us!',
			{
				modal: true,
				detail: 'Help our open-source project stay alive. We\'ll auto- star on GitHub when you sign in. No extra steps!',
			},
			'Proceed to Login', 'No, I don\'t support',
		);
		if (selectedOption === 'Proceed to Login') {
			globalState.update('github.support', true);
		}
	}

	// Sign in with GitHub using the authentication API
	await getGitHubSession({ createIfNone: true });

	// Log the successful sign-in
	logger.notifyInfo('Successfully signed in with GitHub');
};


/**
 * Registers the GitHub sign-in command for the Flexpilot extension.
 */
export const registerGithubSignInCommand = () => {
	registerDisposable(vscode.commands.registerCommand('flexpilot.github.signin', handler));
	logger.info('Command `flexpilot.github.signin` registered');
};
