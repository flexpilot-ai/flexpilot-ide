/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LanguageModelV1 } from 'ai';

/**
 * Interface for chat model call settings.
 */
export interface ICompletionsConfig {
	modelId: string;
	apiKey: string;
	baseUrl: string;
	maxInputTokens: number;
	debouncerWait: number;
	temperature: number;
	maxOutputTokens: number;
}

/**
 * Interface for chat model provider results.
 */
export interface IChatModelProviderResult {
	model: LanguageModelV1;
	settings: {
		temperature: number;
	};
}

/**
 * Abstract class for chat model providers.
 */
export abstract class IChatModelProvider {
	static providerName: string;
	static providerId: string;

	constructor(public nickname: string) { }

	async initialize(): Promise<void> {
		return Promise.resolve();
	}

	static configure(configId: string): Promise<boolean> {
		throw new Error(`Method not implemented for ${configId}`);
	}

	static model(configId: string): IChatModelProviderResult {
		throw new Error(`Method not implemented for ${configId}`);
	}
}

/**
 * Interface for model configuration.
 */
export interface IModelConfig {
	family: string;
	maxInputTokens: number;
	maxOutputTokens: number;
	version: string;
	nickname: string;
	modelId: string;
	providerId: string;
	supportsToolCalls: boolean;
}

/**
 * Interface representing the configuration for a language.
 */
export interface ILanguageConfig {
	comment: {
		start: string;
		end: string;
	};
	markdown: string;
}

/**
 * Interface representing a embedding model configuration.
 */
interface IGitHubCopilotEmbeddingModel {
	id: string;
	name: string;
	object: 'model';
	preview: boolean;
	vendor: string;
	version: string;
	model_picker_enabled?: boolean;
	capabilities: {
		type: 'embedding';
		family: string;
		object: string;
		tokenizer: string;
		limits: {
			max_context_window_tokens: number;
		};
	};
}

/**
 * Interface representing a chat model configuration.
 */
export interface IGitHubCopilotChatModel {
	id: string;
	name: string;
	object: 'model';
	preview: boolean;
	vendor: string;
	version: string;
	model_picker_enabled: boolean;
	capabilities: {
		type: 'chat';
		family: string;
		object: string;
		tokenizer: string;
		limits: {
			max_context_window_tokens: number;
			max_output_tokens: number;
			max_prompt_tokens: number;
		};
		supports: {
			tool_calls: boolean;
			parallel_tool_calls: boolean;
			dimensions?: boolean;
		};
	};
}

/**
 * Interface representing a GitHub Copilot model.
 */
export type IGitHubCopilotModel = IGitHubCopilotEmbeddingModel | IGitHubCopilotChatModel;
