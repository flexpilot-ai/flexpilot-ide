/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { logger } from './logger';
import { registerDisposable, setExtensionContext } from './context';
import { checkUpdateAvailable, setContext } from './utilities';
import { registerCheckInternetConnectionCommand } from './commands/check-connection';
import { handleGitHubFileSystemProvider } from './fs-provider';
import { registerVfsInfoMessageCommand } from './commands/vfs-info-message';
import { registerEditorVariable, registerSelectionVariable, registerTerminalLastCommandVariable, registerTerminalSelectionVariable } from './variables';
import { registerGithubSignInCommand } from './commands/github-sign-in';
import { registerStatusIconMenuCommand } from './commands/status-icon-menu';
import { registerConfigureModelCommand } from './commands/configure-model';
import { registerUsagePreferencesCommand } from './commands/usage-preferences';
import { registerCommitMessageCommand } from './commands/commit-message';
import { registerShowDiagnosticsCommand } from './commands/show-diagnostics';

/**
 * Activates the extension.
 */
export async function activate(context: vscode.ExtensionContext) {
	await setContext('isLoaded', false);
	await setContext('isNetworkConnected', true);
	await setContext('isLoggedIn', false);

	// Check for updates when the extension is activated
	checkUpdateAvailable();

	// set the extension context to the global context
	setExtensionContext(context);

	// Register the logger with the context
	registerDisposable(logger);
	logger.info('Activating Flexpilot extension');

	// Register the commands
	registerCheckInternetConnectionCommand();
	registerGithubSignInCommand();
	registerUsagePreferencesCommand();
	registerConfigureModelCommand();
	registerStatusIconMenuCommand();
	registerVfsInfoMessageCommand();
	registerCommitMessageCommand();
	registerShowDiagnosticsCommand();

	// Register the variables
	registerEditorVariable();
	registerSelectionVariable();
	registerTerminalLastCommandVariable();
	registerTerminalSelectionVariable();

	// Check the internet connection and activate
	vscode.commands.executeCommand('flexpilot.checkInternetConnection');

	// Check if the workspace is a GitHub workspace
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (
		process.platform === 'web' &&
		workspaceFolder &&
		workspaceFolder.uri.scheme === 'web-fs' &&
		workspaceFolder.uri.authority === 'github'
	) {
		// Handle the GitHub file system provider
		logger.info('Handling GitHub file system provider');
		await handleGitHubFileSystemProvider(workspaceFolder.uri);
	}

	// Show the chat panel
	vscode.commands.executeCommand('workbench.action.chat.open');
	logger.info('Flexpilot extension initial activation complete');

	// Set the extension as loaded
	await setContext('isLoaded', true);
}
