/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import TurndownService from 'turndown';
// @ts-ignore
import { tables as turndownTables } from 'turndown-plugin-gfm';
import * as vscode from 'vscode';

/**
 * Props for the Message component.
 */
interface MessageProps {
	role: 'assistant' | 'user' | 'system';
	children: React.ReactNode;
	reference?: vscode.Uri | vscode.Location; // NOSONAR
}

/**
 * Props for the Code component.
 */
interface CodeProps {
	children: React.ReactNode;
	language?: string;
}

/**
 * Message component for rendering chat messages.
 */
export const Message: React.FC<MessageProps> = ({ children, role }) => (
	<div data-role={role}>{children}</div>
);

/**
 * Code component for rendering code blocks.
 */
export const Code: React.FC<CodeProps> = ({ children, language }) => (
	<pre>
		<code className={language ? `language-${language}` : ''}>{children}</code>
	</pre>
);

// Configure TurndownService for consistent Markdown conversion
const turndownService = new TurndownService({
	headingStyle: 'atx',
	hr: '---',
	bulletListMarker: '-',
	codeBlockStyle: 'fenced',
	fence: '```',
	emDelimiter: '*',
	strongDelimiter: '**',
	linkStyle: 'inlined',
	linkReferenceStyle: 'full',
	preformattedCode: true,
});

const turndownPluginGfm = require('turndown-plugin-gfm');
const gfm = turndownPluginGfm.gfm;
turndownService.use(gfm);

/**
 * Converts a JSX element to a chat message.
 */
export const jsxToChatMessage = (
	jsx: React.ReactElement
): vscode.LanguageModelChatMessage => {
	// Convert the JSX element to HTML and then to Markdown
	const html = ReactDOMServer.renderToStaticMarkup(jsx);
	if (jsx.type !== Message) {
		throw new Error('Invalid JSX element: expected Message component');
	}
	const content = turndownService.turndown(html);

	// Create a chat message based on the role of the JSX element
	switch ((jsx.props as any).role) {
		case 'assistant':
			return vscode.LanguageModelChatMessage.Assistant(content);
		case 'user':
			return vscode.LanguageModelChatMessage.User(content);
		case 'system':
			return new vscode.LanguageModelChatMessage(
				vscode.LanguageModelChatMessageRole.System,
				content
			);
		default:
			throw new Error(
				`Invalid role in JSX element: ${(jsx.props as any).role}`
			);
	}
};

/**
 * Converts a JSX element to a VS Code MarkdownString.
 */
export const jsxToMarkdown = (
	jsx: React.ReactElement
): vscode.MarkdownString => {
	return new vscode.MarkdownString(
		turndownService.turndown(ReactDOMServer.renderToStaticMarkup(jsx))
	);
};

/**
 * Converts a JSX element to a Markdown string.
 */
export const jsxToMarkdownString = (jsx: React.ReactElement): string => {
	return turndownService.turndown(ReactDOMServer.renderToStaticMarkup(jsx));
};
