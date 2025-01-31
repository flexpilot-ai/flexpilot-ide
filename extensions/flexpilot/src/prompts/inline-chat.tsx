/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Code, Message, jsxToChatMessage } from './jsx-utilities';
import { resolveVariablesToCoreMessages } from '../variables';
import { getEol, getLanguageConfig } from '../utilities';

/**
 * Expands the current selection to full lines.
 */
const expandSelectionToLineBoundary = (editor: vscode.TextEditor) => {
	const start = editor.selection.start.with({ character: 0 });
	let end = editor.selection.end;
	if (end.character !== 0) {
		end = new vscode.Position(end.line + 1, 0);
	}
	editor.selection = new vscode.Selection(start, end);
};

/**
 * Builds the request for the inline chat based on the context and request
 */
export const buildRequest = async (
	response: vscode.ChatResponseStream,
	context: vscode.ChatContext,
	request: vscode.ChatRequest,
	editor: vscode.TextEditor
): Promise<vscode.LanguageModelChatMessage[]> => {
	// Initialize the messages array to store the generated messages
	const messages: vscode.LanguageModelChatMessage[] = [];

	// Extract instructions from the history and request to provide context
	const instructions: string[] = [];
	context.history.map((item) => {
		if ('prompt' in item && item.prompt) {
			instructions.push(item.prompt);
		}
	});
	instructions.push(request.prompt);

	// Get the language configuration for the current document
	const { comment, markdown } = getLanguageConfig(editor.document.languageId);

	// Get the full range of the document
	const fullRange = editor.document.validateRange(
		new vscode.Range(0, 0, editor.document.lineCount, 0)
	);

	// Expand the selection to full lines for better context
	expandSelectionToLineBoundary(editor);

	// Add the system message with the role and context information
	messages.push(
		jsxToChatMessage(
			<Message role='system'>
				<h2>
					<strong>Very Important Points To Note</strong>
				</h2>
				<ul>
					<li>
						You are an AI programming assistant and a skilled programmer named{' '}
						<strong>Flexpilot</strong>, who is{' '}
						<strong>working inside VS Code IDE</strong> in{' '}
						<strong>{process.platform}</strong> operating system, assisting a
						fellow developer in{' '}
						<strong>
							updating or fixing a selected piece of code as per their
							instructions.
						</strong>
					</li>
					<li>
						Your colleague will provide you with various file contents, symbols,
						code snippets, etc ... for reference from various files in current
						project codebase, as well as detailed instructions on what needs to
						be done. Your task is to make the necessary changes to the selected
						piece of code according to the given instructions.
					</li>
					<li>
						Ensure that the updated selection content has{' '}
						<strong>proper indentation and formatting</strong> to maintain
						consistency with the codebase.
					</li>
					<li>
						When giving the updated selection content, provide the{' '}
						<strong>exact code</strong> that can be replaced{' '}
						<strong>as it is</strong> with the whole content of the original
						selection. <strong>Do not truncate or shorten the code</strong> by
						saying 'rest of the code goes here' or 'existing code goes here' or
						similar placeholders. It is important to include the full and exact
						code that needs to be replaced.
					</li>
					<li>
						The <strong>updated-selection-content</strong> should have the code
						that replaces
						<strong>only the highlighed section</strong> and not outside of
						highlighed section.
					</li>
					<li>
						Strictly follow the given response format.{' '}
						<strong>
							Dont enclose your response in any other tags like <code>```</code>
						</strong>
					</li>
				</ul>

				<h2>Response Format</h2>
				<p>
					<strong>The response should follow below format strictly</strong>
				</p>
				<pre>
					{`
<file-modification>
	<change-description>
		Brief Text description and little bit of explanation of why this particular change was made
	</change-description>
	<updated-selection-content>
import * as fs from 'fs';
	</updated-selection-content>
</file-modification>
					`.trim()}
				</pre>
			</Message>
		)
	);

	// Resolve variables to core messages
	const variables = await resolveVariablesToCoreMessages(request, response);
	variables.forEach((item) => messages.push(item));

	// Add the user prompt message with the working set files and instructions
	messages.push(
		jsxToChatMessage(
			<Message role='user'>
				<p>
					Please give me the updated code snippet based on the provided{' '}
					<strong>instructions</strong>.
				</p>
				<h3>Complete File Content with the selected area highlighted</h3>
				<p>
					<strong>NOTE:</strong>The selection is highlighed between lines{' '}
					{`${comment.start} START_OF_THE_CODE_EDIT_SELECTION ${comment.end}`}{' '}
					and {`${comment.start} END_OF_THE_CODE_EDIT_SELECTION ${comment.end}`}
				</p>
				<Code language={markdown}>
					{editor.document.getText(
						fullRange.with({ end: editor.selection.start })
					)}
					{comment.start} START_OF_THE_CODE_EDIT_SELECTION {comment.end}
					{getEol(editor.document)}
					{editor.document.getText(editor.selection)}
					{comment.start} END_OF_THE_CODE_EDIT_SELECTION {comment.end}
					{getEol(editor.document)}
					{editor.document.getText(
						fullRange.with({ start: editor.selection.end })
					)}
				</Code>
				<h3>File Properties</h3>
				<ul>
					<li>
						<strong>File Path:</strong> {editor.document.uri.fsPath}
					</li>
					<li>
						<strong>Coding Language:</strong> {editor.document.languageId}
					</li>
				</ul>
				<h3>Very Important Points to Note</h3>
				<ul>
					<li>
						Ensure that the updated selection content has{' '}
						<strong>proper indentation and formatting</strong> to maintain
						consistency with the codebase.
					</li>
					<li>
						When giving the updated selection content, provide the{' '}
						<strong>exact code</strong> that can be replaced{' '}
						<strong>as it is</strong> with the whole content of the original
						selection. <strong>Do not truncate or shorten the code</strong> by
						saying 'rest of the code goes here' or 'existing code goes here' or
						similar placeholders. It is important to include the full and exact
						code that needs to be replaced.
					</li>
					<li>
						The <strong>updated-selection-content</strong> should have the code
						that replaces
						<strong>only the highlighed section</strong> and not outside of
						highlighed section.
					</li>
					<li>
						Strictly follow the given response format.{' '}
						<strong>
							Dont enclose your response in any other tags like <code>```</code>
						</strong>
					</li>
				</ul>
				<h3>Instructions</h3>
				<ul>
					{instructions.map((instruction, index) => (
						<li key={index}>{instruction}</li>
					))}
				</ul>
				<h3>Response Format</h3>
				<p>
					<strong>The response should follow below format strictly</strong>
				</p>
				<pre>
					{`
<file-modification>
	<change-description>
		Brief Text description and little bit of explanation of why this particular change was made
	</change-description>
	<updated-selection-content>
import * as fs from 'fs';
	</updated-selection-content>
</file-modification>
					`.trim()}
				</pre>
			</Message>
		)
	);

	// Return the generated messages for the request to be sent to the chat model
	return messages;
};
