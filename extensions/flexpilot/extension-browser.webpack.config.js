/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

'use strict';

const path = require('path');
const withBrowserDefaults = require('../shared.webpack.config').browser;

module.exports = withBrowserDefaults({
	context: __dirname,
	node: false,
	entry: {
		extension: './src/extension.ts',
	},
	resolve: {
		extensions: ['.tsx', '.ts', '.js', '.jsx'],
		fallback: {
			assert: require.resolve('assert'),
			buffer: require.resolve('buffer'),
			path: require.resolve('path-browserify'),
			process: require.resolve('process/browser'),
			stream: require.resolve('readable-stream'),
			url: require.resolve('url'),
			util: require.resolve('util'),
			os: require.resolve('os-browserify/browser'),
		},
	},
	target: 'webworker',
	module: {
		rules: [{
			test: /\.(ts|tsx)$/,
			exclude: /node_modules/,
			use: [{
				loader: 'ts-loader'
			}]
		}]
	}
});
