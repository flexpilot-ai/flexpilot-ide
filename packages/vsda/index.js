/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const crypto = require('crypto');

class Signer {
	constructor() { }
	free() { }
	sign(salted_message) {
		// Create SHA-256 hash
		const hash = crypto.createHash('sha256')
			.update(salted_message)
			.digest();

		// Convert to URL-safe base64 without padding
		return hash.toString('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');
	}
}

class Validator {
	validate() { return 'ok'; }
}

module.exports = { signer: Signer, validator: Validator };
