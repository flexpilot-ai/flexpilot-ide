/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Code, jsxToChatMessage, Message } from './jsx-utilities';
import { getEol, getLanguageConfig } from '../utilities';

/**
 * Builds the request for the rename symbol prompt based on the context and request
 */
export const buildRequest = async (
	document: vscode.TextDocument,
	range: vscode.Range
): Promise<vscode.LanguageModelChatMessage[]> => {
	// Initialize the messages array to store the generated messages
	const messages: vscode.LanguageModelChatMessage[] = [];

	// Get the language configuration for the current document
	const { comment, markdown } = getLanguageConfig(document.languageId);

	// Add the system message with the role and context information
	messages.push(
		jsxToChatMessage(
			<Message role='system'>
				<h2>Important Instructions</h2>
				<ul>
					<li>
						You are an AI programming assistant and a skilled programmer named{' '}
						<strong>Flexpilot</strong>, who is{' '}
						<strong>working inside VS Code IDE</strong> in{' '}
						<strong>{process.platform}</strong> operating system, assisting a
						fellow developer in <strong>renaming a symbol</strong>.
					</li>
					<li>
						Your colleague will provide you with the file content for reference
						and also the symbol that needs to be renamed.
					</li>
					<li>
						Provide the top 5 relevant and different names for the symbol in the
						following HTML format. Use {'<relevant-symbol-names>'} as the
						starting boundary and {'</relevant-symbol-names>'} as the ending
						boundary for the response output.
					</li>
					<li>
						Strictly follow the given response format.{' '}
						<strong>
							Dont enclose your response in any other tags like <code>```</code>
						</strong>
					</li>
				</ul>
				<h2>Response Format</h2>
				<pre>
					{`
<relevant-symbol-names>
	<symbol-name>SymbolNameOne</symbol-name>
	<symbol-name>SymbolNameTwo</symbol-name>
	<symbol-name>SymbolNameThree</symbol-name>
	<symbol-name>SymbolNameFour</symbol-name>
	<symbol-name>SymbolNameFive</symbol-name>
</relevant-symbol-names>
						`}
				</pre>
			</Message>
		)
	);

	// Add the context prompt including the current file content and selection
	messages.push(
		jsxToChatMessage(
			<Message role='user'>
				<h1>File Content For Reference</h1>
				<br />
				Use the following file content for reference to rename the symbol. I
				have explcitly highlighted the symbol location.
				<br />
				<br />
				<Code language={markdown}>
					{document.getText(
						new vscode.Range(
							new vscode.Position(0, 0),
							new vscode.Position(range.start.line, 0)
						)
					)}
					{`${comment.start}Start of Symbol Location${comment.end}`}
					{getEol(document)}
					{document.getText(
						new vscode.Range(
							new vscode.Position(range.start.line, 0),
							new vscode.Position(range.start.line + 1, 0)
						)
					)}
					{`${comment.start}End of Symbol Location${comment.end}`}
					{getEol(document)}
					{document.getText(
						new vscode.Range(
							new vscode.Position(range.start.line + 1, 0),
							new vscode.Position(range.end.line + 1, 0)
						)
					)}
				</Code>
			</Message>
		)
	);

	// Add the prompt message for the user to provide the relevant symbol names
	messages.push(
		jsxToChatMessage(
			<Message role='user'>
				<p>
					Give me the top 5 relevant and different names for the symbol
					<strong>{document.getText(range)}</strong> to which it can be renamed
					to.
				</p>
			</Message>
		)
	);

	// Return the generated messages for the request to be sent to the chat model
	return messages;
};
