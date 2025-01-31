/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Message, jsxToChatMessage, jsxToMarkdown } from './jsx-utilities';
import { resolveVariablesToCoreMessages } from '../variables';

/**
 * Generates the welcome message for the user in the editor session panel.
 */
export const getWelcomeMessage = (username: string): vscode.MarkdownString => {
	return jsxToMarkdown(
		<Message role='user'>
			<p>
				Welcome, <b>@{username}</b>
			</p>
			<p>
				Start your editing session by defining a set of files that you want to
				work with. Then ask Flexpilot for the changes you want to make.
			</p>
		</Message>
	);
};

/**
 * Builds the request for the editing session based on the context and request
 */
export const buildRequest = async (
	response: vscode.ChatResponseStream,
	context: vscode.ChatContext,
	request: vscode.ChatRequest
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
							updating or fixing the codebase as per their instructions by
							making multi-file edits.
						</strong>
					</li>
					<li>
						Your colleague will provide you with various file contents, symbols,
						code snippets, etc ... for reference from various files in current
						project codebase, as well as detailed instructions on what needs to
						be done. Your task is to make the necessary changes to the codebase
						according to the given instructions.
					</li>
					<li>
						Ensure that the updated file content has proper indentation and
						formatting to maintain consistency with the codebase.
					</li>
					<li>
						When giving the updated file content, provide the
						<strong>exact code</strong> that can be replaced{' '}
						<strong>as it is</strong> with the whole content of the original
						file. <strong>Do not truncate or shorten the code</strong> by saying
						'rest of the code goes here' or 'existing code goes here' or 'rest
						of the code remains unchanged' or similar placeholders. It is
						important to include the full and exact code that needs to be
						replaced.
					</li>
					<li>
						Ensure that the file URI is in its full format, including the
						scheme, authority, and other components. For example:
						<strong>
							web-fs://github/folder/containing/script/src/index.ts
						</strong>
						Where <strong>web-fs</strong> is the scheme, <strong>github</strong>{' '}
						is the authority, and the rest is the path.{' '}
						<strong>
							This is important for properly identifying the file.
						</strong>
					</li>
					<li>
						<strong>
							You cannot create new files, delete files or change files outside
							of files mentioned in the working set.
						</strong>
						You can only modify files that are mentioned as part of the working
						set only. If you require a file that is not part of the working set,
						please ask the user to add it to the working set first, before
						moving forward.
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
		Text description of why this particular test1.ts change was made
	</change-description>
	<complete-file-uri>
		file:///exact/complete/path/to/file/test1.ts
	</complete-file-uri>
	<updated-file-content>
import * as fs from 'fs';
	</updated-file-content>
</file-modification>

<file-modification>
	<change-description>
		Text description of why this particular test2.ts change was made
	</change-description>
	<complete-file-uri>
		file:///exact/complete/path/to/file/test2.ts
	</complete-file-uri>
	<updated-file-content>
import * as path from 'path';
	</updated-file-content>
</file-modification>
						`.trim()}
				</pre>
			</Message>
		)
	);

	// Resolve variables to core messages
	const variables = await resolveVariablesToCoreMessages(request, response);
	variables.forEach((item) => messages.push(item));

	// Extract working set files from the request
	const workingSet: vscode.Uri[] = [];
	for (const reference of request.references) {
		if (
			reference.modelDescription === 'edit-session:working-set' &&
			reference.value instanceof vscode.Uri
		) {
			workingSet.push(reference.value);
		}
	}

	// Add the user prompt message with the working set files and instructions
	messages.push(
		jsxToChatMessage(
			<Message role='user'>
				<p>
					Please make the necessary changes to the codebase based on the
					instructions provided below in the{' '}
					<strong>instructions section</strong>.
				</p>
				<h3>Working Set Files</h3>
				<ul>
					{workingSet.map((uri, index) => (
						<li key={index}>{uri.toString()}</li>
					))}
				</ul>
				<h3>Very Important Note</h3>
				<ul>
					<li>
						Ensure that the updated file content has proper indentation and
						formatting to maintain consistency with the codebase.
					</li>
					<li>
						When giving the updated file content, provide the
						<strong>exact code</strong> that can be replaced{' '}
						<strong>as it is</strong> with the whole content of the original
						file. <strong>Do not truncate or shorten the code</strong> by saying
						'rest of the code goes here' or 'existing code goes here' or 'rest
						of the code remains unchanged' or similar placeholders. It is
						important to include the full and exact code that needs to be
						replaced.
					</li>
					<li>
						Ensure that the file URI is in its full format, including the
						scheme, authority, and other components. For example:
						<strong>
							web-fs://github/folder/containing/script/src/index.ts
						</strong>
						Where <strong>web-fs</strong> is the scheme, <strong>github</strong>{' '}
						is the authority, and the rest is the path.{' '}
						<strong>
							This is important for properly identifying the file.
						</strong>
					</li>
					<li>
						<strong>
							You cannot create new files, delete files or change files outside
							of files mentioned in the working set.
						</strong>
						You can only modify files that are mentioned as part of the working
						set only. If you require a file that is not part of the working set,
						please ask the user to add it to the working set first, before
						moving forward.
					</li>
					<li>
						Strictly follow the given response format.{' '}
						<strong>
							Dont enclose your response in any other tags like <code>```</code>
						</strong>
					</li>
					<li>
						<strong>
							You can only modify files that are mentioned as part of the
							working set only.
						</strong>
						If you require to modify a file that is not part of the working set,
						please ask the user to add it to the working set first, before
						moving forward.
					</li>
					<li>
						<strong>
							Dont assume files in locations which are not mentioned in the
							request or working set.
						</strong>
					</li>
					<li>
						<strong>
							You cannot create new files, delete files or change files outside
							of files mentioned in the working set.
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
		Text description of why this particular test1.ts change was made
	</change-description>
	<complete-file-uri>
		file:///exact/complete/path/to/file/test1.ts
	</complete-file-uri>
	<updated-file-content>
import * as fs from 'fs';
	</updated-file-content>
</file-modification>

<file-modification>
	<change-description>
		Text description of why this particular test2.ts change was made
	</change-description>
	<complete-file-uri>
		file:///exact/complete/path/to/file/test2.ts
	</complete-file-uri>
	<updated-file-content>
import * as path from 'path';
	</updated-file-content>
</file-modification>
						`.trim()}
				</pre>
			</Message>
		)
	);

	// Return the generated messages for the request to be sent to the chat model
	return messages;
};
