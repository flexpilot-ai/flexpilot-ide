/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { logger } from './logger';
import { Code, jsxToMarkdownString, Message } from './prompts/jsx-utilities';
import { getLanguageConfig, getTerminalType } from './utilities';
import { registerDisposable } from './context';

// Variable to store the last terminal command executed
let lastTerminalExecutedCommand: vscode.TerminalExecutedCommand | undefined;

/**
 * Registers a chat variable resolver for the current editor.
 */
export const registerEditorVariable = () => {
	registerDisposable(
		vscode.chat.registerChatVariableResolver(
			'flexpilot.editor',
			'editor',
			'The visible source code in the active editor',
			undefined,
			undefined,
			{
				resolve2: async (_name, _context, stream) => {
					// Get the active editor
					const activeEditor = vscode.window.activeTextEditor;

					// If no active editor is found, log a warning and return an empty array
					if (!activeEditor) {
						logger.warn('No active editor found, Skipping');
						return [];
					}

					// Get the language configuration for the active editor
					const language = getLanguageConfig(activeEditor.document.languageId);
					stream.reference(activeEditor.document.uri);

					// Return the prompt message with full level and description
					return [
						{
							value: jsxToMarkdownString(
								<Message role='user'>
									<h1>File Content From Active Editor For Reference</h1>
									<span>
										<strong>Complete content of the file</strong> opened
										currently in the active editor in VS Code IDE for reference.
									</span>
									<h3>Properties</h3>
									<table>
										<thead>
											<tr>
												<th>Key</th>
												<th>Value</th>
											</tr>
										</thead>
										<tbody>
											<tr>
												<td>Tag:</td>
												<td>#editor</td>
											</tr>
											<tr>
												<td>File:</td>
												<td>{activeEditor.document.uri.toString()}</td>
											</tr>
										</tbody>
									</table>
									<h3>Complete File Content</h3>
									<Code language={language.markdown}>
										{activeEditor.document.getText().trim()}
									</Code>
								</Message>
							),
							level: vscode.ChatVariableLevel.Full,
						},
					];
				},
				resolve: () => [],
			},
			'Current Editor',
			new vscode.ThemeIcon('file')
		)
	);
};

/**
 * Registers a chat variable resolver for the active selection in the editor.
 */
export const registerSelectionVariable = () => {
	registerDisposable(
		vscode.chat.registerChatVariableResolver(
			'flexpilot.selection',
			'selection',
			'The current selection in the active editor',
			undefined,
			undefined,
			{
				resolve2: (_name, _context, stream) => {
					// Get the active editor
					const activeEditor = vscode.window.activeTextEditor;

					// If no active editor is found, log a warning and return an empty array
					if (!activeEditor) {
						logger.warn('No active editor found with selection, Skipping');
						return [];
					}

					// Get the language configuration for the active editor
					const language = getLanguageConfig(activeEditor.document.languageId);
					const selection = activeEditor.selection;
					stream.reference(
						new vscode.Location(activeEditor.document.uri, selection)
					);

					// Return the prompt message with full level and description
					return [
						{
							value: jsxToMarkdownString(
								<Message role='user'>
									<h1>
										File Content From Active Editor Selection For Reference
									</h1>
									<span>
										<strong>Partial content selected from the file</strong>{' '}
										opened currently in the active editor in VS Code IDE for
										reference.
									</span>
									<h3>Properties</h3>
									<table>
										<thead>
											<tr>
												<th>Key</th>
												<th>Value</th>
											</tr>
										</thead>
										<tbody>
											<tr>
												<td>Tag:</td>
												<td>#selection</td>
											</tr>
											<tr>
												<td>File:</td>
												<td>{activeEditor.document.uri.toString()}</td>
											</tr>
											<tr>
												<td>Selection Start Line Number:</td>
												<td>{selection.start.line + 1}</td>
											</tr>
											<tr>
												<td>Selection End Line Number:</td>
												<td>{selection.end.line + 1}</td>
											</tr>
										</tbody>
									</table>
									<h3>Partial File Content</h3>
									<Code language={language.markdown}>
										{activeEditor.document.getText(selection).trim()}
									</Code>
								</Message>
							),
							level: vscode.ChatVariableLevel.Full,
						},
					];
				},
				resolve: () => [],
			},
			'Active Selection',
			new vscode.ThemeIcon('selection')
		)
	);
};

/**
 * Registers a variable resolver for the last command executed in the terminal.
 */
export const registerTerminalLastCommandVariable = () => {
	// listen for terminal command execution event and store the last terminal command executed
	registerDisposable(
		vscode.window.onDidExecuteTerminalCommand(
			(event: vscode.TerminalExecutedCommand) =>
				(lastTerminalExecutedCommand = event)
		)
	);

	// register the chat variable resolver for terminal last command
	registerDisposable(
		vscode.chat.registerChatVariableResolver(
			'flexpilot.terminalLastCommand',
			'terminalLastCommand',
			'The last command executed in the terminal',
			undefined,
			undefined,
			{
				resolve2: () => {
					// If no last terminal shell execution is found, log a warning and return an empty array
					if (!lastTerminalExecutedCommand) {
						logger.warn('No last terminal shell execution found, Skipping');
						return [];
					}

					// Get the terminal type
					const terminalType = getTerminalType(
						lastTerminalExecutedCommand.terminal
					);

					// Return the prompt message with full level and description
					return [
						{
							level: vscode.ChatVariableLevel.Full,
							value: jsxToMarkdownString(
								<Message role='user'>
									<h1>Last Terminal Command Executed For Reference</h1>
									<span>
										Last command executed in the terminal shell for reference in
										VS Code IDE.
									</span>
									<span>
										tag: <strong>#terminalLastCommand</strong>
									</span>
									{lastTerminalExecutedCommand.commandLine && (
										<>
											<br />
											The following is the last command run in the terminal:
											<br />
											<Code language={terminalType}>
												{lastTerminalExecutedCommand.commandLine}
											</Code>
										</>
									)}
									{lastTerminalExecutedCommand.cwd && (
										<>
											<br />
											It was run in the directory:
											<br />
											<Code language={terminalType}>
												{lastTerminalExecutedCommand.cwd.toString()}
											</Code>
										</>
									)}
									{lastTerminalExecutedCommand.terminal && (
										<>
											<br />
											It was run using shell type:
											<br />
											<Code language={terminalType}>{terminalType}</Code>
										</>
									)}
									{lastTerminalExecutedCommand.output && (
										<>
											<br />
											It has the following output:
											<br />
											<Code language={terminalType}>
												{lastTerminalExecutedCommand.output}
											</Code>
										</>
									)}
								</Message>
							),
						},
					];
				},
				resolve: () => [],
			},
			'Terminal Last Command',
			new vscode.ThemeIcon('terminal')
		)
	);
};

/**
 * Registers a terminal selection variable for the chat extension.
 */
export const registerTerminalSelectionVariable = () => {
	registerDisposable(
		vscode.chat.registerChatVariableResolver(
			'flexpilot.terminalSelection',
			'terminalSelection',
			'The selected text from terminal',
			undefined,
			undefined,
			{
				resolve2: () => {
					// Get the active terminal
					const terminal = vscode.window.activeTerminal;

					// If no active terminal or selection is found, log a warning and return an empty array
					if (!terminal?.selection) {
						logger.warn('No active terminal selection found, Skipping');
						return [];
					}

					// Return the prompt message with full level and description
					return [
						{
							level: vscode.ChatVariableLevel.Full,
							value: jsxToMarkdownString(
								<Message role='user'>
									<h1>Current Terminal Selection For Reference</h1>
									<span>
										Use below content from active terminal selection for
										reference
									</span>
									<span>
										tag: <strong>#terminalSelection</strong>
									</span>
									<Code language={getTerminalType(terminal)}>
										{terminal.selection.trim()}
									</Code>
								</Message>
							),
						},
					];
				},
				resolve: () => [],
			},
			'Terminal Selection',
			new vscode.ThemeIcon('terminal')
		)
	);
};

/**
 * Resolves the complete file content for the given URI and variable name.
 */
const resolveCompleteFileContent = async (
	uri: vscode.Uri,
	variableName?: string
): Promise<vscode.LanguageModelChatMessage> => {
	// Open the document and get the language configuration
	const document = await vscode.workspace.openTextDocument(uri);
	const language = getLanguageConfig(document.languageId);

	return vscode.LanguageModelChatMessage.User(
		jsxToMarkdownString(
			<Message role='user'>
				<h1>File Content For Reference</h1>
				<span>
					<strong>Complete content of a file</strong> that is part of the
					project's codebase in the current VS Code IDE for reference.
				</span>
				<h3>Properties</h3>
				<table>
					<thead>
						<tr>
							<th>Key</th>
							<th>Value</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>Tag:</td>
							<td>#{variableName}</td>
						</tr>
						<tr>
							<td>Description:</td>
							<td>
								Complete content of a file from the project's codebase for
								reference
							</td>
						</tr>
						<tr>
							<td>File:</td>
							<td>{document.uri.toString()}</td>
						</tr>
					</tbody>
				</table>
				<h3>Complete File Content</h3>
				<Code language={language.markdown}>{document.getText().trim()}</Code>
			</Message>
		)
	);
};

/**
 * Resolves the partial file content for the given location and variable name.
 */
const resolvePartialFileContent = async (
	location: vscode.Location,
	variableName?: string
): Promise<vscode.LanguageModelChatMessage> => {
	// Open the document and get the language configuration
	const document = await vscode.workspace.openTextDocument(location.uri);
	const language = getLanguageConfig(document.languageId);

	return vscode.LanguageModelChatMessage.User(
		jsxToMarkdownString(
			<Message role='user'>
				<h1>Partial File Content For Reference</h1>
				<span>
					Below content refers to a <strong>specific section</strong> of a file
					from the project's codebase for reference.
				</span>
				<h3>Properties</h3>
				<table>
					<thead>
						<tr>
							<th>Key</th>
							<th>Value</th>
						</tr>
					</thead>
					<tbody>
						{variableName && (
							<tr>
								<td>Tag:</td>
								<td>#{variableName}</td>
							</tr>
						)}
						<tr>
							<td>Description:</td>
							<td>
								Partial content of a file from the project's codebase for
								reference
							</td>
						</tr>
						<tr>
							<td>File:</td>
							<td>{document.uri.toString()}</td>
						</tr>
						<tr>
							<td>Selection's Start Line Number:</td>
							<td>{location.range.start.line + 1}</td>
						</tr>
						<tr>
							<td>Selection's End Line Number:</td>
							<td>{location.range.end.line + 1}</td>
						</tr>
					</tbody>
				</table>
				<h3>Partial File Content</h3>
				<Code language={language.markdown}>
					{document.getText(location.range).trim()}
				</Code>
			</Message>
		)
	);
};

/**
 * Resolves the code symbol for the given location and variable name.
 */
const resolveCodeSymbol = async (
	location: vscode.Location,
	variableName: string
): Promise<vscode.LanguageModelChatMessage> => {
	// Open the document and get the language configuration
	const document = await vscode.workspace.openTextDocument(location.uri);
	const language = getLanguageConfig(document.languageId);

	return vscode.LanguageModelChatMessage.User(
		jsxToMarkdownString(
			<Message role='user'>
				<h1>Symbol Reference</h1>
				<span>
					Below content refers to a <strong>specific symbol</strong> from the
					project's codebase for reference.
				</span>
				<span>
					A symbol in vscode IDE represents a named entity in the source code,
					such as a function, variable, class, method, or any other programmatic
					construct.
				</span>
				<h3>Properties</h3>
				<table>
					<thead>
						<tr>
							<th>Key</th>
							<th>Value</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>Tag:</td>
							<td>#{variableName}</td>
						</tr>
						<tr>
							<td>File:</td>
							<td>{document.uri.toString()}</td>
						</tr>
						<tr>
							<td>Start Line Number:</td>
							<td>{location.range.start.line + 1}</td>
						</tr>
						<tr>
							<td>End Line Number:</td>
							<td>{location.range.end.line + 1}</td>
						</tr>
					</tbody>
				</table>
				<h3>Symbol Definition</h3>
				<Code language={language.markdown}>
					{document.getText(location.range).trim()}
				</Code>
			</Message>
		)
	);
};

/**
 * Resolves the working set content for the given URI and returns a chat message.
 */
const resolveWorkingSet = async (
	uri: vscode.Uri
): Promise<vscode.LanguageModelChatMessage> => {
	// Open the document and get the language configuration
	const document = await vscode.workspace.openTextDocument(uri);
	const language = getLanguageConfig(document.languageId);

	return vscode.LanguageModelChatMessage.User(
		jsxToMarkdownString(
			<Message role='user'>
				<h1>Working Set Reference</h1>
				<span>
					Below content refers to a file which is added to the{' '}
					<strong>working set</strong> for the <strong>editing session</strong>.
				</span>
				<h3>Properties</h3>
				<table>
					<thead>
						<tr>
							<th>Key</th>
							<th>Value</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>File:</td>
							<td>{document.uri.toString()}</td>
						</tr>
					</tbody>
				</table>
				<h3>Working Set Content</h3>
				<Code language={language.markdown}>{document.getText().trim()}</Code>
			</Message>
		)
	);
};

/**
 * Resolves variables in the given chat request to core messages.
 */
export const resolveVariablesToCoreMessages = async (
	request: vscode.ChatRequest,
	response: vscode.ChatResponseStream
): Promise<vscode.LanguageModelChatMessage[]> => {
	const messages: vscode.LanguageModelChatMessage[] = [];

	// Sort so that edit-session:working-set is in the last
	const references = Array.from(request.references).sort((a) =>
		a.modelDescription === 'edit-session:working-set' ? 1 : -1
	);

	// Iterate over each reference and resolve the message
	for (const reference of references) {
		if (
			reference.modelDescription === 'edit-session:working-set' &&
			reference.value instanceof vscode.Uri
		) {
			messages.push(await resolveWorkingSet(reference.value));
		} else if (reference.id === 'vscode.symbol') {
			const location = reference.value as vscode.Location;
			messages.push(await resolveCodeSymbol(location, reference.name));
		} else if (
			reference.id.startsWith('flexpilot.') &&
			typeof reference.value === 'string'
		) {
			response.reference2({ variableName: reference.name });
			messages.push(vscode.LanguageModelChatMessage.User(reference.value));
		} else if (reference.value instanceof vscode.Location) {
			const variableName = reference.range ? reference.name : undefined;
			messages.push(
				await resolvePartialFileContent(reference.value, variableName)
			);
		} else if (reference.value instanceof vscode.Uri) {
			const variableName = reference.range ? reference.name : undefined;
			messages.push(
				await resolveCompleteFileContent(reference.value, variableName)
			);
		} else {
			logger.warn(`unknown reference type: ${reference.id}`);
		}
	}

	// Return the resolved messages array containing the user messages
	return messages;
};
