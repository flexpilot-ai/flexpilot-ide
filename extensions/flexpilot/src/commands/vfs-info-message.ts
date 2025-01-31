/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { logger } from '../logger';
import { registerDisposable } from '../context';

/**
 * Handles the information message for the virtual file system.
 */
const handler = async () => {
	vscode.window.showInformationMessage(
		'This browser-based IDE offers a minimal experience with temporary data storage that will be lost on refresh or close; use the desktop version for full features and persistence.',
		{ modal: true }, 'Continue', 'Download Desktop IDE'
	).then((selection) => {
		if (selection === 'Download Desktop IDE') {
			vscode.env.openExternal(vscode.Uri.parse('https://flexpilot.ai'));
		}
	});
};

/**
 * Registers the information message command for the virtual file system.
 */
export const registerVfsInfoMessageCommand = () => {
	registerDisposable(vscode.commands.registerCommand('flexpilot.vfs.info.message', handler));
	logger.info('Command `flexpilot.vfs.info.message` registered');
};
