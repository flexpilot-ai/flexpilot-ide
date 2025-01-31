/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { LOCATIONS } from './constants';
import { ICompletionsConfig, IModelConfig } from './types';

// The extension context for the Flexpilot extension
let extensionContext: vscode.ExtensionContext;

/**
 * Sets the extension context if it has not been set already.
 */
export const setExtensionContext = (context: vscode.ExtensionContext) => {
	if (!extensionContext) { extensionContext = context; }
};

/**
 * Retrieves the extension context.
 */
const getExtensionContext = (): vscode.ExtensionContext => {
	if (!extensionContext) {
		throw new Error('Extension context has not been initialized');
	}
	return extensionContext;
};

/**
 * Interface representing the model preferences.
 */
type IModelPreferences = Record<`preference.${(typeof LOCATIONS)[number]['id']}`, string>;

export const usagePreferences = {
	/**
	 * Retrieves the usage preference for a given key.
	 */
	get: <T1 extends keyof IModelPreferences>(key: T1): IModelPreferences[T1] | undefined => {
		return getExtensionContext().globalState.get(key);
	},

	/**
	 * Update the usage preference for a given key.
	 */
	update: async <T1 extends keyof IModelPreferences>(key: T1, value: IModelPreferences[T1] | undefined): Promise<void> => {
		return getExtensionContext().globalState.update(key, value);
	}
};

/**
 * Interface representing the model configurations.
 */
export const modelConfigs = {
	/**
	 * Retrieves a value from permanent storage.
	 */
	get: <T1 extends IModelConfig>(key: string): T1 | undefined => {
		return getExtensionContext().globalState.get<T1>(`flexpilot.modelProvider.${key}`);
	},

	/**
	 * Sets a value in permanent storage.
	 */
	update: async <T1 extends IModelConfig>(key: string, value: T1 | undefined): Promise<void> => {
		return getExtensionContext().globalState.update(`flexpilot.modelProvider.${key}`, value);
	},

	/**
	 * List model configuration ids.
	 */
	list: (): string[] => {
		const result: string[] = [];
		for (const item of getExtensionContext().globalState.keys()) {
			if (item.startsWith('flexpilot.modelProvider')) {
				result.push(item.replace('flexpilot.modelProvider.', ''));
			}
		}
		return result;
	}
};

/**
 * Interface representing the global state store.
 */
type IGlobalState = Record<`completions.disabled.${string}`, boolean> & {
	'github.support': boolean;
	'completions.config': ICompletionsConfig;
	'completions.disabled': boolean;
};

export const globalState = {
	/**
	 * Retrieves a value from permanent storage.
	 */
	get: <T1 extends keyof IGlobalState>(key: T1): IGlobalState[T1] | undefined => {
		return getExtensionContext().globalState.get(key);
	},

	/**
	 * Sets a value in permanent storage.
	 */
	update: async <T1 extends keyof IGlobalState>(key: T1, value: IGlobalState[T1] | undefined): Promise<void> => {
		return getExtensionContext().globalState.update(key, value);
	}
};

/**
 * Clears the global state when there's no active session.
 */
export const clearGlobalState = async (): Promise<void> => {
	// Clear the global state when there's no active session
	const keys = getExtensionContext().globalState.keys();
	for (const key of keys) {
		await getExtensionContext().globalState.update(key, undefined);
	}
};

/**
 * Registers a disposable to be disposed when the extension is deactivated.
 */
export const registerDisposable = (disposable: vscode.Disposable): void => {
	getExtensionContext().subscriptions.push(disposable);
};
