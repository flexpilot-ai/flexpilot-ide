/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface ICustomDialogOutputResult {
	/**
	 * This will only be defined if the confirmation was created
	 * with the checkbox option defined.
	 */
	readonly checkboxChecked?: boolean;

	/**
	 * Will be true if the dialog was confirmed with the primary button pressed.
	 */
	readonly confirmed: boolean;

	/**
	 * Values for the input fields as provided by the user or `undefined` if none.
	 */
	readonly values?: string[];
}

interface ICheckbox {
	readonly label: string;
	readonly checked?: boolean;
}

interface IInputElement {
	readonly type?: 'text' | 'password';
	readonly label?: string;
	readonly value?: string;
	readonly placeholder?: string;
}

interface ICustomDialogOptions {
	readonly disableCloseAction?: boolean;
	readonly closeOnLinkClick?: boolean;
	readonly dialogId?: 'flexpilot-model-config';
}

type DialogType = 'none' | 'info' | 'error' | 'question' | 'warning';

export interface ICustomDialogInputOptions {

	readonly type?: DialogType;

	readonly title?: string;

	readonly message: string;

	readonly detail?: string;

	readonly checkbox?: ICheckbox;

	/**
	 * Allows to enforce use of custom dialog even in native environments.
	 */
	readonly custom?: boolean | ICustomDialogOptions;

	/**
	 * If not provided, defaults to `Cancel`.
	 */
	readonly cancelButton?: string;

	readonly inputs: IInputElement[];

	/**
	 * If not provided, defaults to `Ok`.
	 */
	readonly primaryButton?: string;
}
