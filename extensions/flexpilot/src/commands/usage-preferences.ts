/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IModelConfig } from '../types';
import { logger } from '../logger';
import { ModelProviders } from '../providers';
import { modelConfigs, registerDisposable, usagePreferences } from '../context';
import { LOCATIONS } from '../constants';

/**
 * Handles the model configuration process for the Flexpilot extension.
 */
interface ILocationQuickPickItem extends vscode.QuickPickItem {
	locationId: typeof LOCATIONS[number]['id'];
}

/**
 * Interface for the model quick pick item.
 */
interface IModelQuickPickItem extends vscode.QuickPickItem {
	configId?: string;
	provider?: typeof ModelProviders[number];
}

/**
 * Handles the model configuration process for the Flexpilot extension.
 */
const handler = async () => {
	// Get the location to modify the model usage preferences
	const locationQuickPickItems: ILocationQuickPickItem[] = [];
	for (const location of LOCATIONS) {
		const modelId = usagePreferences.get(`preference.${location.id}`);
		let existingNickname: string | undefined;
		if (modelId) {
			const [chatModel] = await vscode.lm.selectChatModels({ id: modelId });
			existingNickname = chatModel?.name;
		}
		locationQuickPickItems.push({
			locationId: location.id,
			label: location.name,
			detail: existingNickname
				? `Currently uses \`${existingNickname}\``
				: 'Currently Disabled',
			description: `(${location.description})`,
		});
	}

	// Show the quick pick for location selection
	const pickedLocation = await vscode.window.showQuickPick(
		locationQuickPickItems,
		{
			title: 'Flexpilot: Modify Model Usage Preferences',
			ignoreFocusOut: true,
			canPickMany: false,
			placeHolder: 'Select the usage location',
		},
	);
	if (!pickedLocation) { return; }

	// Get the chat models to select from for the location
	const chatModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });

	const modelQuickPickItems: IModelQuickPickItem[] = [
		{
			label: 'Disable',
			kind: vscode.QuickPickItemKind.Separator
		},
		{
			label: `Disable model usage for \`${pickedLocation.label}\``,
			alwaysShow: true,
		}
	];
	for (const chatModel of chatModels) {
		const config = modelConfigs.get<IModelConfig>(chatModel.id);
		if (!config) {
			logger.warn(`Configuration not found: ${chatModel.id}`);
			continue;
		}
		const provider = ModelProviders.find((item) => item.providerId === config.providerId);
		if (!provider) {
			logger.warn(`ModelProvider not found: ${chatModel.id}`);
			continue;
		}
		modelQuickPickItems.unshift({
			detail: `${chatModel.family}`,
			buttons: [
				{
					iconPath: new vscode.ThemeIcon('gear'),
					tooltip: 'Configure',
				},
				{
					iconPath: new vscode.ThemeIcon('trash'),
					tooltip: 'Delete',
				},
			],
			provider: provider,
			configId: chatModel.id,
			label: chatModel.name,
			alwaysShow: true,
			description: `(${provider.providerName})`,
		});
	}

	// Show the quick pick for model selection
	const pickedModel = await vscode.window.showQuickPick(modelQuickPickItems, {
		title: 'Flexpilot: Modify Model Usage Preferences',
		ignoreFocusOut: true,
		canPickMany: false,
		placeHolder: `Select the model config to be used in \`${pickedLocation.label}\``,
	});
	if (!pickedModel) { return; }

	// Update the usage preference
	if (pickedModel.label === `Disable \`${pickedLocation.label}\``) {
		await usagePreferences.update(`preference.${pickedLocation.locationId}`, undefined);
		logger.notifyInfo(`Model usage for \`${pickedLocation.label}\` is disabled`);
	} else if (pickedModel.provider) {
		await usagePreferences.update(`preference.${pickedLocation.locationId}`, pickedModel.configId);
		logger.notifyInfo(`Model \`${pickedModel.label}\` is successfully set to be used in \`${pickedLocation.label}\``);
	}
};

/**
 * Registers the model configuration command for the Flexpilot extension.
 */
export const registerUsagePreferencesCommand = () => {
	registerDisposable(vscode.commands.registerCommand('flexpilot.usagePreferences', handler));
	logger.info('Command `flexpilot.usagePreferences` registered');
};
