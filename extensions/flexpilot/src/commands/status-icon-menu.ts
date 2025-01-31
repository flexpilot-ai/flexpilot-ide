/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { logger } from '../logger';
import { globalState, registerDisposable } from '../context';

/**
 * Extends vscode.QuickPickItem with additional properties for custom functionality.
 */
interface ICustomQuickPickItem extends vscode.QuickPickItem {
	status?: string;
	handler?: () => Promise<void>;
}

/**
 * Command handler for displaying a status icon menu with various options.
 */
const handler = async () => {
	// Get the menu items for the status icon menu command handler
	const menuItems: ICustomQuickPickItem[] = [
		{
			label: '',
			kind: vscode.QuickPickItemKind.Separator
		},
		{
			label: '$(chat-editor-label-icon) Open Flexpilot Chat',
			handler: async () => vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus'),
		},
		{
			label: '$(keyboard) Edit Keyboard Shortcuts...',
			handler: async () => vscode.commands.executeCommand('workbench.action.openGlobalKeybindings'),
		},
		{
			label: '$(settings-gear) Edit Settings...',
			handler: async () => vscode.commands.executeCommand('workbench.action.openSettings', 'flexpilot'),
		},
		{
			label: 'Open Diagnostics',
			handler: async () => vscode.commands.executeCommand('flexpilot.show.diagnostics'),
		},
		{
			label: 'Open Logs',
			handler: async () => logger.showOutputChannel(),
		},
		{
			label: '',
			kind: vscode.QuickPickItemKind.Separator
		},
		{
			label: '$(remote-explorer-documentation) View Flexpilot Docs...',
			handler: async () => { await vscode.env.openExternal(vscode.Uri.parse('https://flexpilot.ai/installation')); },
		},
	];

	// Get the active text editor to determine the language ID for completions enable/disable
	if (vscode.window.activeTextEditor) {
		const languageId = vscode.window.activeTextEditor.document.languageId;
		const isDisabled = globalState.get(`completions.disabled.${languageId}`);
		menuItems.unshift(
			{
				label: `\`${isDisabled ? 'Enable' : 'Disable'}\` Completions for \`${languageId}\``,
				handler: async () => { await globalState.update(`completions.disabled.${languageId}`, !isDisabled); },
			}
		);
	}

	// Get the global completions disabled state for the status icon menu command handler
	const isDisabled = globalState.get('completions.disabled');
	menuItems.unshift(
		{
			label: `\`${isDisabled ? 'Enable' : 'Disable'}\` Completions Globally`,
			handler: async () => { await globalState.update('completions.disabled', !isDisabled); },
		}
	);

	// Show the quick pick menu for the status icon menu command handler
	return vscode.window.showQuickPick(menuItems, {
		placeHolder: 'Select an option',
		ignoreFocusOut: true,
		title: 'Flexpilot: Completions Settings',
	}).then((item) => item?.handler ? item.handler() : undefined);
};

/**
 * Registers the `flexpilot.status.icon.menu` command with the VS Code extension context.
 */
export const registerStatusIconMenuCommand = () => {
	registerDisposable(vscode.commands.registerCommand('flexpilot.status.icon.menu', handler));
	logger.info('Command `flexpilot.status.icon.menu` registered');
};
