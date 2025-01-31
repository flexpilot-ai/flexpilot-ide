/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, LanguageModelChatMessageRole } from 'vscode';
import { IModelConfig } from '../types';
import * as vscode from 'vscode';
import { AssistantContent, CoreMessage, CoreTool, jsonSchema, streamText, TextPart, ToolResultPart } from 'ai';
import { GenericChatModelProvider } from './generic';
import { modelConfigs } from '../context';
import { GroqCloudChatModelProvider } from './groq';
import { MistralAIChatModelProvider } from './mistral-ai';
import { OpenAIChatModelProvider } from './openai';
import { GoogleChatModelProvider } from './google';
import { AzureOpenAIChatModelProvider } from './azure';
import { AnthropicChatModelProvider } from './anthropic';
import { AmazonBedrockChatModelProvider } from './bedrock';
import { CohereChatModelProvider } from './cohere';
import { logger } from '../logger';
import { CerebrasChatModelProvider } from './derived';

// List of all available model providers.
export const ModelProviders = [
	AzureOpenAIChatModelProvider,
	GoogleChatModelProvider,
	OpenAIChatModelProvider,
	GroqCloudChatModelProvider,
	CohereChatModelProvider,
	GenericChatModelProvider,
	MistralAIChatModelProvider,
	AnthropicChatModelProvider,
	CerebrasChatModelProvider,
	AmazonBedrockChatModelProvider
] as const;

// Map of all registered providers and their configuration IDs.
const providers = new Map<string, Disposable>();
let defaultChatModel: string | undefined = undefined;

/**
 * Converts a `vscode.LanguageModelChatMessage` to a `CoreMessage`.
 */
const convertChatToCoreMessage = (message: vscode.LanguageModelChatMessage): CoreMessage => {

	// Convert a `vscode.LanguageModelChatMessage` to a `SystemMessage`.
	if (message.role === LanguageModelChatMessageRole.System) {
		const content = message.content
			.map((item) => {
				return item instanceof vscode.LanguageModelTextPart ? item.value.trim() : '';
			})
			.filter((item) => item.length).join(' ,');
		return { role: 'system', content: content };
	}
	// Convert a `vscode.LanguageModelChatMessage` to a `UserMessage` or `ToolMessage`
	else if (message.role === LanguageModelChatMessageRole.User) {
		const toolResultParts: ToolResultPart[] = [];
		const textParts: TextPart[] = [];

		for (const item of message.content) {
			// If the message is a tool result part, add it to the `toolResultParts` array.
			if (item instanceof vscode.LanguageModelToolResultPart) {
				toolResultParts.push({
					type: 'tool-result',
					toolCallId: item.callId,
					result: item.content.map((item) => {
						if (item instanceof vscode.LanguageModelTextPart) {
							return item.value;
						} else {
							return JSON.stringify(item);
						}
					}).join(' ,'),
					toolName: 'test'
				});
			}
			// If the message is a text part, add it to the `textParts` array.
			else if (item instanceof vscode.LanguageModelTextPart && item.value) {
				textParts.push({ type: 'text', text: item.value });
			}
		}
		// Return the `UserMessage` or `ToolMessage` based on the content.
		if (toolResultParts.length) {
			return { role: 'tool', content: toolResultParts };
		} else if (textParts.length) {
			return { role: 'user', content: textParts };
		} else {
			return { role: 'user', content: JSON.stringify(message.content) };
		}
	}
	// Convert a `vscode.LanguageModelChatMessage` to an `AssistantMessage`.
	else if (message.role === LanguageModelChatMessageRole.Assistant) {
		const content: AssistantContent = message.content.map((item) => {
			if (item instanceof vscode.LanguageModelTextPart) {
				return { type: 'text', text: item.value };
			} else if (item instanceof vscode.LanguageModelToolCallPart) {
				let toolArgs: any = item.input;
				try {
					toolArgs = JSON.parse(toolArgs);
				} catch (error) {
					logger.debug('Skipping tool call argument parsing');
				}
				return {
					type: 'tool-call',
					args: toolArgs,
					toolName: item.name,
					toolCallId: item.callId
				};
			} else {
				return { type: 'text', text: '' };
			}
		});
		return { role: 'assistant', content: content };
	} else {
		throw new Error(`Invalid role type ${message.role}`);
	}
};

export const modelProviderManager = {
	/**
	 * Registers a new model provider with the given configuration ID.
	 * If a provider with the same configuration ID already exists, it will be disposed and replaced.
	 */
	async register(configId: string): Promise<void> {

		// Dispose of the existing provider if it exists
		const existingDisposable = providers.get(configId);
		if (existingDisposable) {
			await existingDisposable.dispose();
			providers.delete(configId);
		}

		// Get the model configuration if it exists
		const config = modelConfigs.get<IModelConfig>(configId);
		if (!config) {
			throw new Error(`Configuration not found: ${configId}`);
		}

		// Get the model provider and settings
		const ModelProvider = ModelProviders.find(
			(item) => item.providerId === config.providerId);
		if (!ModelProvider) {
			throw new Error(`Provider not found: ${config.providerId}`);
		}
		const { model, settings } = ModelProvider.model(configId);

		// Set the default chat model if it is not already set
		if (!defaultChatModel) { defaultChatModel = configId; }

		// Register the chat model provider with the Language Model API
		const disposable = vscode.lm.registerChatModelProvider(
			configId,
			{
				/**
				 * Provides a response to the given chat messages.
				 */
				async provideLanguageModelResponse(
					messages: vscode.LanguageModelChatMessage[],
					options: vscode.LanguageModelChatRequestOptions,
					_extensionId: string,
					progress: vscode.Progress<vscode.ChatResponseFragment2>,
					token: vscode.CancellationToken
				): Promise<any> {

					// Create an abort controller and listen for cancellation requests
					const abortController = new AbortController();
					token.onCancellationRequested(() => abortController.abort());

					// Convert the tool configuration to a dictionary of tools
					const tools: Record<string, CoreTool> = {};
					for (const tool of (options.tools || [])) {
						tools[tool.name] = {
							parameters: jsonSchema(tool.inputSchema as any),
							description: tool.description,
						};
					}

					// Determine the tool choice based on the tool mode
					let toolChoice: 'auto' | 'required' | undefined = undefined;
					if (options.toolMode === vscode.LanguageModelChatToolMode.Required) {
						toolChoice = 'required';
					} else if (options.toolMode === vscode.LanguageModelChatToolMode.Auto) {
						toolChoice = 'auto';
					}

					// Convert the chat messages to core messages
					const convertedMessages = messages.map((item) => convertChatToCoreMessage(item));

					// Stream the full response and usage information
					const { fullStream, usage } = streamText({
						...settings,
						model: model,
						toolChoice: toolChoice,
						tools: tools,
						messages: convertedMessages,
						abortSignal: abortController.signal,
						experimental_toolCallStreaming: false
					});

					// Listen for response parts and update the progress
					for await (const part of fullStream) {
						if (part.type === 'text-delta') {
							progress.report({
								index: 0, part:
									new vscode.LanguageModelTextPart(part.textDelta)
							});
						} else if (part.type === 'tool-call') {
							progress.report({
								index: 0,
								part: new vscode.LanguageModelToolCallPart(
									part.toolCallId, part.toolName, part.args
								)
							});
						} else if (part.type === 'error') {
							throw part.error;
						}
					}

					// Return the token usage if requested by the model options
					const tokenUsage = await usage;
					if (tokenUsage?.totalTokens && options.modelOptions?.returnTokenUsage) {
						progress.report({
							index: 0,
							part: new vscode.LanguageModelTextPart(`
								<flexpilot-llm-token-usage>
									${JSON.stringify(tokenUsage)}
								</flexpilot-llm-token-usage>
								`)
						});
					}
				},

				/**
				 * Dummy implementation of the token count provider for the Language Model API.
				 */
				async provideTokenCount(text) {
					if (text instanceof vscode.LanguageModelChatMessage) {
						return text.content
							.map((item) => Math.ceil(JSON.stringify(item).length / 4))
							.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
					} else {
						return Math.ceil(JSON.stringify(text).length / 4);
					}
				}
			},
			{
				family: config.family,
				name: config.nickname,
				maxInputTokens: config.maxInputTokens,
				maxOutputTokens: config.maxOutputTokens,
				version: config.version,
				isDefault: defaultChatModel === configId,
				vendor: 'copilot',
				isUserSelectable: true
			}
		);

		// Store the disposable for the provider in the map
		providers.set(configId, disposable);
	},

	/**
	 * Initializes the model provider manager by registering all items.
	 */
	async initialize(): Promise<void> {
		for (const item of modelConfigs.list()) {
			await modelProviderManager.register(item);
		}
	},

	/**
	 * Disposes of a provider identified by the given configuration ID.
	 */
	async dispose(configId: string): Promise<void> {
		const disposable = providers.get(configId);
		if (disposable) {
			await disposable.dispose();
			providers.delete(configId);
		}
		if (configId === defaultChatModel) {
			defaultChatModel = undefined;
		}
	},

	/**
	 * Disposes all providers managed by the modelProviderManager.
	 */
	async disposeAll(): Promise<void> {
		for (const item of providers.keys()) {
			await modelProviderManager.dispose(item);
		}
	}
};
