/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * LoggerSingleton class provides a centralized logging mechanism for the Flexpilot VS Code extension.
 */
export class LoggerSingleton extends vscode.Disposable {
	private readonly disposable: vscode.Disposable;
	private static instance: LoggerSingleton;
	private readonly outputChannel: vscode.LogOutputChannel;

	/**
	 * Creates a new instance of LoggerSingleton.
	 */
	private constructor() {
		super(() => {
			// Dispose of the output channel and the command registration
			this.outputChannel.dispose();
			this.disposable.dispose();
		});

		// Create the output channel
		this.outputChannel = vscode.window.createOutputChannel('Flexpilot', {
			log: true,
		});

		// Register the command to view logs
		this.disposable = vscode.commands.registerCommand(
			'flexpilot.viewLogs',
			() => this.outputChannel.show(),
		);
	}

	/**
	 * Shows the output channel.
	 */
	public showOutputChannel(): void {
		this.outputChannel.show();
	}

	/**
	 * Returns the singleton instance of LoggerSingleton.
	 */
	public static getInstance(): LoggerSingleton {
		if (!LoggerSingleton.instance) {
			LoggerSingleton.instance = new LoggerSingleton();
		}
		return LoggerSingleton.instance;
	}

	/**
	 * Logs an informational message to the output channel.
	 */
	public info(message: string, ...args: unknown[]): void {
		this.outputChannel.info(message, ...args);
	}

	/**
	 * Logs an informational message and shows a notification.
	 */
	public notifyInfo(message: string, ...args: unknown[]): void {
		this.outputChannel.info(message, ...args);

		// Show information notification
		vscode.window
			.showInformationMessage(message, 'Open Docs')
			.then(async (selection) => {
				if (selection === 'Open Docs') {
					vscode.env.openExternal(
						vscode.Uri.parse('https://flexpilot.ai/installation'),
					);
				}
			});
	}

	/**
	 * Logs a warning message to the output channel.
	 */
	public warn(message: string, ...args: unknown[]): void {
		this.outputChannel.warn(message, ...args);
	}

	/**
	 * Logs an warning message and shows a notification.
	 */
	public notifyWarn(message: string, ...args: unknown[]): void {
		this.outputChannel.warn(message, ...args);

		// Show warning notification
		vscode.window
			.showWarningMessage(message, 'View Details')
			.then((selection) => {
				if (selection === 'View Details') {
					this.outputChannel.show();
				}
			});
	}

	/**
	 * Logs a debug message to the output channel.
	 */
	public debug(message: string, ...args: unknown[]): void {
		this.outputChannel.debug(message, ...args);
	}

	/**
	 * Logs an error message to the output channel.
	 */
	public error(error: string | Error, ...args: unknown[]): void {
		this.outputChannel.error(error, ...args);
	}

	/**
	 * Logs an error message and shows a notification.
	 */
	public notifyError(message: string, error?: string | Error, ...args: unknown[]): void {
		if (error) {
			this.outputChannel.error(error, ...args);
		}
		this.outputChannel.error(message);

		// Show error notification
		vscode.window
			.showErrorMessage(message, 'View Details')
			.then((selection) => {
				if (selection === 'View Details') {
					this.outputChannel.show();
				}
			});
	}
}

// Export a singleton instance of the logger
export const logger = LoggerSingleton.getInstance();
