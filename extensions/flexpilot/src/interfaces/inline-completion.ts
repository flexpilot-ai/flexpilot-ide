/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { logger } from '../logger';
import { globalState } from '../context';
import { corsEnableUrl, getLanguageConfig } from '../utilities';
import OpenAI from 'openai';
import { ICompletionsConfig } from '../types';

// Cache the last completion items
const lastCompletionCache = { suffix: '', prefix: '' };
let inlineCompletionItemProvider: vscode.Disposable | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;

/**
 * Retrieves the cached completion items if available for the current position.
 */
const getCompletionCache = (document: vscode.TextDocument, position: vscode.Position): vscode.InlineCompletionList | undefined => {
	const prefix = document.getText(
		new vscode.Range(new vscode.Position(0, 0), position),
	);
	const suffix = document.getText(
		new vscode.Range(position, new vscode.Position(document.lineCount + 1, 0))
	);
	if (
		lastCompletionCache.prefix.trim().length &&
		lastCompletionCache.prefix.startsWith(prefix) &&
		lastCompletionCache.suffix.trim().length &&
		lastCompletionCache.suffix.endsWith(suffix)
	) {
		return new vscode.InlineCompletionList([
			{
				insertText: lastCompletionCache.prefix.slice(prefix.length),
				range: new vscode.Range(position, position),
			},
		]);
	}
	return undefined;
};

/**
 * Generates completions for the current document and position.
 */
const generateCompletions = async (
	modelConfig: ICompletionsConfig,
	position: vscode.Position,
	document: vscode.TextDocument,
): Promise<vscode.InlineCompletionList> => {
	// Limit the number of tokens for prompt
	const promptCharactersLimit = modelConfig.maxInputTokens * 4;

	// Get the prefix for prompt
	let prefixRange = new vscode.Range(0, 0, position.line, 0);
	const pointerLinePrefix = new vscode.Range(prefixRange.end, position);
	if (document.getText(pointerLinePrefix).trim()) {
		prefixRange = prefixRange.with({ end: position });
	}
	let prefixText = document.getText(prefixRange).trimStart();

	// Get the suffix for prompt
	const suffixStart = position.with({ character: 0 }).translate(1);
	const suffixEnd = new vscode.Position(document.lineCount + 1, 0);
	let suffixRange = new vscode.Range(suffixStart, suffixEnd);
	const pointerLineSuffix = new vscode.Range(
		position,
		document.lineAt(position).range.end,
	);
	const pointerLineSuffixText = document.getText(pointerLineSuffix);
	let suffixText = document.getText(suffixRange);
	if (/[a-zA-Z0-9]/.test(pointerLineSuffixText.trim())) {
		suffixRange = suffixRange.with({ start: position });
		suffixText = document.getText(suffixRange);
	}
	suffixText = suffixText.trimEnd();

	// Get the file header
	const language = getLanguageConfig(document.languageId);
	const commentStart = language.comment.start;
	const commentEnd = language.comment.end ?? '';
	let header = `${commentStart} File Path: \`${document.uri.fsPath}\` ${commentEnd}\n`;
	header += `${commentStart} Language ID: \`${language.markdown}\` ${commentEnd}`;

	// Truncate prefix or suffix if it exceeds the context window
	const maxPrefixLength =
		Math.floor(0.85 * promptCharactersLimit) - header.length;
	const maxSuffixLength =
		Math.floor(0.15 * promptCharactersLimit);
	if (
		prefixText.length > maxPrefixLength &&
		suffixText.length > maxSuffixLength
	) {
		prefixText = prefixText.slice(-maxPrefixLength);
		suffixText = suffixText.slice(0, maxSuffixLength);
	} else if (
		prefixText.length > maxPrefixLength &&
		suffixText.length <= maxSuffixLength
	) {
		const diff = suffixText.length - promptCharactersLimit;
		prefixText = prefixText.slice(diff);
	} else if (
		prefixText.length <= maxPrefixLength &&
		suffixText.length > maxSuffixLength
	) {
		const diff = promptCharactersLimit - prefixText.length;
		suffixText = suffixText.slice(0, diff);
	}

	// Add header tokens before prefix
	prefixText = header + '\n'.repeat(2) + prefixText;

	// Set multiple line generations only if it's a continued generation
	const stopSequence = document.lineAt(position).text.trim()
		? ['\n']
		: ['\n'.repeat(2)];
	// Stopper from suffix helps reduce code repetition from suffix
	const suffixLines = suffixText
		.split('\n')
		.map((item) => item.trim())
		.filter((item) => item.trim());
	if (suffixLines.length > 1) {
		stopSequence.push(suffixLines[0]);
	}

	// Invoke the completion model
	const openai = new OpenAI({
		apiKey: modelConfig.apiKey,
		baseURL: corsEnableUrl(modelConfig.baseUrl),
	});

	// Generate completions from the model
	const completion = await openai.completions.create({
		max_tokens: modelConfig.maxOutputTokens,
		stop: stopSequence,
		model: modelConfig.modelId,
		temperature: 0,
		prompt: prefixText.trimStart(),
		suffix: suffixText.trimEnd(),
	});

	// @ts-ignore
	let response: string = completion.choices[0].text || completion.choices[0].message?.content;
	if (prefixText.trimStart().endsWith(' ')) {
		response = response.trimStart();
	}
	if (suffixText.trimEnd().startsWith(' ')) {
		response = response.trimEnd();
	}
	if (!response) {
		return new vscode.InlineCompletionList([]);
	}

	// Get the range to insert the completion
	let insertRange = pointerLinePrefix;
	let insertText = response;
	// If the prefix is empty, set the insert range to the start of the line
	if (document.getText(insertRange).trim()) {
		insertText = document.getText(insertRange) + response;
	}
	if (pointerLineSuffixText && !pointerLineSuffixText.trim()) {
		// If the suffix contains only empty spaces or tabs
		insertText = insertText.trimEnd();
	} else if (!/[a-zA-Z0-9]/.test(pointerLineSuffixText.trim())) {
		// If the suffix contains non-alphanumeric characters only
		let partResponse = response;
		for (const char of pointerLineSuffixText) {
			const charIndex = partResponse.indexOf(char);
			if (!char.trim()) {
				// If empty space or tab character
				insertRange = insertRange.with({
					end: insertRange.end.translate(0, 1),
				});
			} else if (charIndex >= 0) {
				// If special character part of response
				partResponse = partResponse.slice(charIndex);
				insertRange = insertRange.with({
					end: insertRange.end.translate(0, 1),
				});
			} else {
				// Break if the character not in response
				break;
			}
		}
	}

	// Remove empty lines at the end of the string
	const lines = insertText.split('\n');
	while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
		lines.pop();
	}
	insertText = lines.join('\n');

	// Store cache for the current completion
	const cachePrefix = document.getText(
		new vscode.Range(new vscode.Position(0, 0), insertRange.start),
	);
	const cacheSuffix = document.getText(
		new vscode.Range(
			insertRange.end,
			new vscode.Position(document.lineCount + 1, 0),
		),
	);
	lastCompletionCache.prefix = cachePrefix + insertText;
	lastCompletionCache.suffix = cacheSuffix;

	return new vscode.InlineCompletionList([
		{ insertText: insertText, range: insertRange },
	]);
};

/**
 * The inline completion item provider for the extension.
 */
const completionsRequestHandler: vscode.InlineCompletionItemProvider = {
	async provideInlineCompletionItems(document, position, _context, token) {
		// Check cache and return if available
		const cache = getCompletionCache(document, position);
		if (cache) {
			return cache;
		}

		// Debounce the completion request
		const abortController = new AbortController();
		if (statusBarItem) {
			statusBarItem.text = '$(copilot)';
		}

		// Return empty if the model configuration is not available
		const modelConfig = globalState.get('completions.config');
		if (!modelConfig) {
			return new vscode.InlineCompletionList([]);
		}

		// Check if completions are disabled globally
		const isDisabled = globalState.get('completions.disabled');
		if (isDisabled) {
			return new vscode.InlineCompletionList([]);
		}

		// Check if completions are disabled for the current language ID
		const languageId = document.languageId;
		if (globalState.get(`completions.disabled.${languageId}`)) {
			return new vscode.InlineCompletionList([]);
		}

		// Sleep for the debounce wait time before generating completions
		await new Promise((resolve) => setTimeout(resolve, modelConfig.debouncerWait));

		// Return empty if the token is cancelled during the sleep
		if (token.isCancellationRequested) {
			if (statusBarItem) {
				statusBarItem.text = '$(copilot)';
			}
			return new vscode.InlineCompletionList([]);
		}

		// Generate completions and handle errors
		try {
			if (statusBarItem) {
				statusBarItem.text = '$(loading~spin)';
			}
			return await generateCompletions(modelConfig, position, document);
		} catch (error) {
			if (!abortController.signal.aborted) {
				// Log error if not due to cancellation
				logger.notifyError('Error generating completions', error);
			}
			return new vscode.InlineCompletionList([]);
		} finally {
			if (statusBarItem) {
				statusBarItem.text = '$(copilot)';
			}
		}
	},
};

/**
 * Registers the inline completion item provider and the status bar item for the extension.
 */
export const register = async () => {
	// Dispose of the existing disposable resources
	await inlineCompletionItemProvider?.dispose();
	await statusBarItem?.dispose();

	// Register the status bar item for the extension
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	statusBarItem.accessibilityInformation = { label: 'Flexpilot Status', role: 'status' };
	statusBarItem.tooltip = 'Flexpilot Status';
	statusBarItem.name = 'Flexpilot Status';
	statusBarItem.text = '$(copilot)';
	statusBarItem.command = 'flexpilot.status.icon.menu';
	statusBarItem.show();

	// Register the inline completion item provider
	inlineCompletionItemProvider = vscode.languages.registerInlineCompletionItemProvider(
		{ pattern: '**/*' }, completionsRequestHandler
	);
	logger.info('Inline completion provider registered');
};

/**
 * Disposes of the disposable resource if it exists.
 */
export const dispose = async () => {
	await inlineCompletionItemProvider?.dispose();
	await statusBarItem?.dispose();
};
