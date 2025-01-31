/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Code, jsxToChatMessage, Message } from './jsx-utilities';
import { Repository } from '../../../../extensions/git/src/api/git';

/**
 * Generates a system prompt for creating git commit messages.
 */
const getSystemPrompt = (): vscode.LanguageModelChatMessage => {
	return jsxToChatMessage(
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
						Generating a meaninful commit message for his current git changes
					</strong>
				</li>
				<li>
					First, think step-by-step, Analyze the CODE CHANGES thoroughly to
					understand what's been modified.
				</li>
				<li>
					Identify the purpose of the changes to answer the 'why' for the commit
					messages, also considering the optionally provided RECENT USER
					COMMITS.
				</li>
				<li>
					Review the provided RECENT REPOSITORY COMMITS to identify established
					commit message conventions. Focus on the format and style, ignoring
					commit-specific details like refs, tags, and authors.
				</li>
				<li>
					Generate a thoughtful and succinct commit message for the given CODE
					CHANGES. It MUST follow the established writing conventions.
				</li>
				<li>
					Remove any meta information like issue references, tags, or author
					names from the commit message. The developer will add them.
				</li>
				<li>
					Strictly follow the given response format.{' '}
					<strong>
						Dont enclose your response in any other tags like <code>```</code>
					</strong>
				</li>
			</ul>
			<h2>Response Format</h2>
			<span>
				<strong>The response should follow this exact format:</strong>
			</span>
			<pre>
				{`<git-commit-message>Meaningful commit message goes here</git-commit-message>`}
			</pre>
			<h2>Example Responses</h2>
			<pre>
				{`<git-commit-message>feat: improve page load with lazy loading for images</git-commit-message>`}
			</pre>
			<pre>
				{`<git-commit-message>Fix bug preventing submitting the signup form</git-commit-message>`}
			</pre>
			<pre>
				{`<git-commit-message>chore: update npm dependency to latest stable version</git-commit-message>`}
			</pre>
			<pre>
				{`<git-commit-message>Update landing page banner color per client request</git-commit-message>`}
			</pre>
		</Message>
	);
};

/**
 * Generates a code diff prompt message for the language model.
 */
const getCodeDiffPrompt = (diff: string): vscode.LanguageModelChatMessage => {
	return jsxToChatMessage(
		<Message role='user'>
			<h1>CODE CHANGES:</h1>
			<Code language='git-diff'>{diff}</Code>
		</Message>
	);
};

/**
 * Generates a prompt containing the recent commits of a given repository.
 */
const getRepositoryCommitsPrompt = async (
	repository: Repository
): Promise<vscode.LanguageModelChatMessage | undefined> => {
	const recentCommits = await repository.log({ maxEntries: 10 });
	if (!recentCommits.length) {
		return undefined;
	}
	return jsxToChatMessage(
		<Message role='user'>
			<h1>RECENT REPOSITORY COMMITS:</h1>
			<ul>
				{recentCommits.map((log) => (
					<li key={log.message}>
						<Code language='text'>{log.message}</Code>
					</li>
				))}
			</ul>
		</Message>
	);
};

/**
 * Generates a prompt containing the recent commits made by the author in the given repository.
 */
const getAuthorCommitsPrompt = async (repository: Repository) => {
	const authorName =
		(await repository.getConfig('user.name')) ??
		(await repository.getGlobalConfig('user.name'));
	const authorCommits = await repository.log({
		maxEntries: 10,
		author: authorName,
	});
	if (!authorCommits.length) {
		return undefined;
	}
	return jsxToChatMessage(
		<Message role='user'>
			<h1>RECENT AUTHOR COMMITS:</h1>
			<ul>
				{authorCommits.map((log) => (
					<li key={log.message}>
						<Code language='text'>{log.message}</Code>
					</li>
				))}
			</ul>
		</Message>
	);
};

/**
 * Generates a user prompt for the commit message suggestion.
 */
const getUserPrompt = (): vscode.LanguageModelChatMessage => {
	return jsxToChatMessage(
		<Message role='user'>
			<p>
				Please provide a brief meaningful commit message for the given{' '}
				<strong>CODE CHANGES</strong>.
			</p>
			<li>
				Strictly follow the given response format.{' '}
				<strong>
					Dont enclose your response in any other tags like <code>```</code>
				</strong>
			</li>
			<h2>Response Format</h2>
			<span>
				<strong>The response should follow this exact format:</strong>
			</span>
			<pre>
				{`<git-commit-message>Meaningful commit message goes here</git-commit-message>`}
			</pre>
		</Message>
	);
};

/**
 * Builds a series of prompts to generate a commit message based on the repository's state.
 */
export const buildRequest = async (repository: Repository) => {
	// Get the diff of the staged changes in the repository
	const diff = (await repository.diff(true)) || (await repository.diff(false));
	if (!diff) {
		vscode.window
			.showErrorMessage(
				'No staged changes found to commit. Please stage changes and try again.',
				'Stage All Changes'
			)
			.then((selection) => {
				if (selection === 'Stage All Changes') {
					vscode.commands.executeCommand('git.stageAll', repository);
				}
			});
		return undefined;
	}

	// Build the commit message prompts based on the repository state
	const messages: vscode.LanguageModelChatMessage[] = [
		getSystemPrompt(),
		getCodeDiffPrompt(diff),
	];

	// Add repository commit prompts if available
	const repoCommits = await getRepositoryCommitsPrompt(repository);
	if (repoCommits) {
		messages.push(repoCommits);
	}

	// Add author commit prompts if available
	const authorCommits = await getAuthorCommitsPrompt(repository);
	if (authorCommits) {
		messages.push(authorCommits);
	}

	// Add the user prompt for the commit message
	messages.push(getUserPrompt());

	// Return the generated prompts
	return messages;
};
