/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const fs = require('fs');

// Update turndown package.json to remove browser field
const path = 'node_modules/turndown/package.json';
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
delete pkg.browser;
fs.writeFileSync(path, JSON.stringify(pkg, null, 2));
