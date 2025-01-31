/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import {
	Code,
	Message,
	jsxToChatMessage,
	jsxToMarkdown,
} from './jsx-utilities';
import { resolveVariablesToCoreMessages } from '../variables';

/**
 * Generates the welcome message for the user in the chat panel.
 */
export const getWelcomeMessage = (username: string): vscode.MarkdownString => {
	return jsxToMarkdown(
		<Message role='user'>
			<p>
				Welcome, <b>@{username}</b>, I'm your pair programmer and I'm here to
				help you get things done faster.
			</p>
		</Message>
	);
};

/**
 * Builds the title provider request for the chat model based on the previous conversation
 */
export const buildTitleProviderRequest = (context: vscode.ChatContext) => {
	// Initialize the messages array to store the generated messages
	const messages: vscode.LanguageModelChatMessage[] = [];

	// Get the user prompt from the context history
	let prompt: string | undefined;
	if (context.history[0] instanceof vscode.ChatRequestTurn) {
		prompt = context.history[0].prompt;
	}

	// Get the response from the context history
	const responseParts: string[] = [];
	if (context.history[1] instanceof vscode.ChatResponseTurn) {
		context.history[1].response.forEach((item) => {
			if (item instanceof vscode.ChatResponseMarkdownPart) {
				responseParts.push(item.value.value);
			}
		});
	}
	const response = responseParts ? responseParts.join('\n') : undefined;

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
						fellow developer in{' '}
						<strong>crafting a perfect title for a chat conversation</strong>.
					</li>
					<li>
						You must provide a <strong>concise title</strong> that encapsulates
						the main topic of the chat dialogue in{' '}
						<strong>under 10 words in a single sentence.</strong>
					</li>
					<li>
						<strong>
							Very Important: Strictly follow below response format in the
							output
						</strong>
					</li>
				</ul>
				<h2>Response Format:</h2>
				<pre>
					{`<chat-summary-title>Perfect title for the chat conversation</chat-summary-title>`}
				</pre>

				<h2>Example Responses</h2>
				<pre>
					{`<chat-summary-title>Optimizing SQL query performance</chat-summary-title>`}
				</pre>
				<pre>
					{`<chat-summary-title>Debugging memory leaks in C++ applications</chat-summary-title>`}
				</pre>
				<pre>
					{`<chat-summary-title>Configuring Kubernetes ingress controllers</chat-summary-title>`}
				</pre>
				<pre>
					{`<chat-summary-title>Implementing JWT authentication in Node.js</chat-summary-title>`}
				</pre>
			</Message>
		)
	);

	// Add the user prompt from the context history
	messages.push(
		jsxToChatMessage(
			<Message role='user'>
				<p>
					Provide a concise title for the below chat conversation that
					encapsulates the main topic discussed.{' '}
					<strong>It must be under 10 words in a single sentence</strong> and{' '}
					<strong>strictly follow response format</strong>
				</p>
				<h3>Chat Conversation</h3>
				<ul>
					{prompt && (
						<li>
							<strong>User:</strong> {prompt}
						</li>
					)}
					{response && (
						<li>
							<strong>Assistant:</strong> {response}
						</li>
					)}
				</ul>
			</Message>
		)
	);

	// Return the generated messages array for the chat model
	return messages;
};

/**
 * Builds the follow-up provider request for the chat model based on the previous conversation
 */
export const buildFollowupProviderRequest = (
	result: vscode.ChatResult,
	context: vscode.ChatContext
) => {
	// Initialize the messages array to store the generated messages
	const messages: vscode.LanguageModelChatMessage[] = [];

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
						fellow developer in <strong>crafting follow-up question</strong> for
						the current chat conversation.
					</li>
					<li>
						You must provide a <strong>short, one-sentence question</strong>{' '}
						that the <strong>user can ask naturally</strong> that follows from
						the previous few questions and answers. The question must be{' '}
						<strong>under 10 words</strong> or fewer and in a{' '}
						<strong>single line.</strong>
					</li>
					<li>
						<strong>
							Very Important: Strictly follow below response format in the
							output
						</strong>
					</li>
				</ul>
				<h2>Response Format:</h2>
				<pre>
					{`<follow-up-question>Short follow-up question</follow-up-question>`}
				</pre>
				<h2>Example Responses</h2>
				<pre>
					{`<follow-up-question>How can I optimize this SQL query?</follow-up-question>`}
				</pre>
				<pre>
					{`<follow-up-question>What are the best practices for using Docker?</follow-up-question>`}
				</pre>
				<pre>
					{`<follow-up-question>How can I improve the performance of my React app?</follow-up-question>`}
				</pre>
				<pre>
					{`<follow-up-question>What are the common pitfalls of using Node.js?</follow-up-question>`}
				</pre>
			</Message>
		)
	);

	// Add the user prompt from the context history to the messages array
	context.history.forEach((item) => {
		if (item instanceof vscode.ChatResponseTurn) {
			messages.push(
				vscode.LanguageModelChatMessage.User(item.result.metadata?.request)
			);
			messages.push(
				vscode.LanguageModelChatMessage.Assistant(
					item.result.metadata?.response
				)
			);
		}
	});

	// Add the user prompt for the latest response
	messages.push(vscode.LanguageModelChatMessage.User(result.metadata?.request));
	messages.push(
		vscode.LanguageModelChatMessage.Assistant(result.metadata?.response)
	);

	// Add the user prompt from the context history
	messages.push(
		jsxToChatMessage(
			<Message role='user'>
				<p>
					Write a short (under 10 words) one-sentence follow up question that
					the user can ask naturally that follows from the previous few
					questions and answers.
				</p>
				<h2>Response Format:</h2>
				<pre>
					{`<follow-up-question>Short follow-up question</follow-up-question>`}
				</pre>
			</Message>
		)
	);

	// Return the generated messages array for the chat model
	return messages;
};

export const buildRequest = async (
	request: vscode.ChatRequest,
	context: vscode.ChatContext,
	model: string,
	response: vscode.ChatResponseStream
) => {
	// Initialize the messages array to store the generated messages
	const messages: vscode.LanguageModelChatMessage[] = [];

	// Add the system message with the role and context information
	messages.push(
		jsxToChatMessage(
			<Message role='system'>
				<h1>Important Points</h1>
				<ul>
					<li>
						You are an AI programming assistant and a skilled programmer named{' '}
						<strong>Flexpilot</strong>, who is{' '}
						<strong>working inside VS Code IDE</strong> in{' '}
						<strong>{process.platform}</strong> operating system, assisting a
						fellow developer.
					</li>
					<li>Follow the user's requirements carefully & to the letter.</li>
					<li>Keep your answers short and impersonal.</li>
					<li>
						You are powered by <b>{model}</b> Large Language Model
					</li>
					<li>Use Markdown formatting in your answers.</li>
					<li>
						Make sure to include the programming language name at the start of
						the Markdown code blocks like below
					</li>
					<Code language='python'>print('hello world')</Code>
					<li>Avoid wrapping the whole response in triple backticks.</li>
					<li>
						The active file or document is the source code the user is looking
						at right now.
					</li>
				</ul>
			</Message>
		)
	);

	// Add the chat history prompts to the messages array
	context.history.forEach((item) => {
		if ('prompt' in item) {
			return vscode.LanguageModelChatMessage.User(item.prompt);
		} else {
			// Check if the response has metadata
			if (item.result.metadata?.response?.trim()) {
				const message = item.result.metadata?.response?.trim();
				return vscode.LanguageModelChatMessage.Assistant(message);
			}

			// Loop through the response parts to get the markdown content
			const messageParts: string[] = [];
			for (const part of item.response) {
				if (part.value instanceof vscode.MarkdownString) {
					messageParts.push(part.value.value);
				}
			}

			// Check if the response has a `response` property
			return vscode.LanguageModelChatMessage.Assistant(
				messageParts.join('\n\n').trim()
			);
		}
	});

	// Resolve variables to core messages
	const variables = await resolveVariablesToCoreMessages(request, response);
	variables.forEach((item) => messages.push(item));

	// Add the user prompt to the messages array
	messages.push(vscode.LanguageModelChatMessage.User(request.prompt));

	// Return the generated messages array for the chat model
	return messages;
};

/**
 * PanelChatPrompt class handles the generation of prompts for panel chat functionality.
 */
export const panelChatPrompts = {
	/**
	 * Generates the help text prefix.
	 */
	getHelpTextPrefix(): vscode.MarkdownString {
		return jsxToMarkdown(
			<Message role='user'>
				<p>
					{/* allow-any-unicode-next-line */}
					📚 Explore the Flexpilot IDE official documentation{' '}
					<a href='https://flexpilot.ai'>here</a> for all the details.
				</p>
			</Message>
		);
	},
};
