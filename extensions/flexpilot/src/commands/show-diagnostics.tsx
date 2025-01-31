/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { logger } from '../logger';
import { registerDisposable } from '../context';
import { getGitHubSession } from '../utilities';
import { Code, jsxToMarkdownString } from '../prompts/jsx-utilities';
import * as os from 'os';

// Extension IDs for the `win-ca` and `mac-ca` extensions
const WIN_CA_EXTENSION_ID = 'ukoloff.win-ca';
const MAC_CA_EXTENSION_ID = 'linhmtran168.mac-ca-vscode';

/**
 * Handles the `flexpilot.show.diagnostics` command.
 */
const handler = async () => {
	const githubSession = await getGitHubSession();
	const message = jsxToMarkdownString(
		<>
			<h2>Flexpilot Diagnostics</h2>
			<ul>
				<li>
					Editor Version: <code>{vscode.version}</code>
				</li>
				<li>
					Platform: <code>{process.platform}</code>
				</li>
			</ul>
			<h2>Environment</h2>
			<ul>
				<li>
					HTTP_PROXY:{' '}
					<code>
						{process.env.http_proxy || process.env.HTTP_PROXY || 'not set'}
					</code>
				</li>
				<li>
					HTTPS_PROXY:{' '}
					<code>
						{process.env.https_proxy || process.env.HTTPS_PROXY || 'not set'}
					</code>
				</li>
				<li>
					NO_PROXY:{' '}
					<code>
						{process.env.no_proxy || process.env.NO_PROXY || 'not set'}
					</code>
				</li>
				<li>
					SSL_CERT_FILE: <code>{process.env.SSL_CERT_FILE || 'not set'}</code>
				</li>
				<li>
					SSL_CERT_DIR: <code>{process.env.SSL_CERT_DIR || 'not set'}</code>
				</li>
				<li>
					OPENSSL_CONF: <code>{process.env.OPENSSL_CONF || 'not set'}</code>
				</li>
			</ul>
			<h2>Node Setup</h2>
			<ul>
				<li>
					Operating system: <code>{os.type()}</code>
				</li>
				<li>
					Operating system version: <code>{os.release()}</code>
				</li>
				<li>
					Operating system architecture: <code>{os.arch()}</code>
				</li>
				<li>
					Node Options:{' '}
					<code>{process.env.NODE_OPTIONS?.trim() || 'not set'}</code>
				</li>
				<li>
					Node Extra CA Certs:{' '}
					<code>{process.env.NODE_EXTRA_CA_CERTS?.trim() || 'not set'}</code>
				</li>
				<li>
					Node TLS Reject Unauthorized:{' '}
					<code>{process.env.NODE_TLS_REJECT_UNAUTHORIZED || 'not set'}</code>
				</li>
			</ul>
			<h2>HTTP Settings</h2>
			<Code language='json'>
				{JSON.stringify(vscode.workspace.getConfiguration('http'), null, 2)}
			</Code>
			<h2>Extensions</h2>
			<ul>
				<li>
					Is `win-ca` installed?:{' '}
					<code>
						{vscode.extensions.getExtension(WIN_CA_EXTENSION_ID)
							? 'true'
							: 'false'}
					</code>
				</li>
				<li>
					Is `mac-ca` installed?:{' '}
					<code>
						{vscode.extensions.getExtension(MAC_CA_EXTENSION_ID)
							? 'true'
							: 'false'}
					</code>
				</li>
			</ul>
			{githubSession && (
				<>
					<h2>Authentication</h2>
					<ul>
						<li>
							GitHub Username: <code>{githubSession?.account.label}</code>
						</li>
						<li>
							GitHub Account ID: <code>{githubSession?.account.id}</code>
						</li>
					</ul>
				</>
			)}
		</>
	);

	// Create a new untitled document
	const document = await vscode.workspace.openTextDocument({
		content: message,
		language: 'markdown',
	});

	// Show the document in a new editor tab
	await vscode.window.showTextDocument(document);
};

/**
 * Registers the `flexpilot.show.diagnostics` command with the VS Code extension context.
 */
export const registerShowDiagnosticsCommand = () => {
	registerDisposable(
		vscode.commands.registerCommand('flexpilot.show.diagnostics', handler)
	);
	logger.info('Command `flexpilot.show.diagnostics` registered');
};
