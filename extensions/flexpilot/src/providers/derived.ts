/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GenericChatModelProvider } from './generic';

/**
 * Cerebras Cloud chat model provider class.
 */
export class CerebrasChatModelProvider extends GenericChatModelProvider {
	static override readonly providerName = 'Cerebras Cloud';
	static override readonly providerId = 'cerebras-cloud';
	static override nicknamePlaceholder = 'e.g., Cerebras Model';
	static override apiKeyPlaceholder = 'e.g., csk-1234567890abcdef...';
	static override baseUrlPlaceholder = 'e.g., https://api.cerebras.ai/v1';
	static override baseUrlDefault = 'https://api.cerebras.ai/v1';
	static override modelIdPlaceholder = 'e.g., llama-3.3-70b';
}
