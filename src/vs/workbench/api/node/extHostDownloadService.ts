/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { join } from '../../../base/common/path.js';
import { tmpdir } from 'os';
import { generateUuid } from '../../../base/common/uuid.js';
import { IExtHostCommands } from '../common/extHostCommands.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { MainContext } from '../common/extHost.protocol.js';
import { URI } from '../../../base/common/uri.js';
import { IExtHostRpcService } from '../common/extHostRpcService.js';
import { copyFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

export class ExtHostDownloadService extends Disposable {

	constructor(
		@IExtHostRpcService extHostRpc: IExtHostRpcService,
		@IExtHostCommands commands: IExtHostCommands
	) {
		super();

		const proxy = extHostRpc.getProxy(MainContext.MainThreadDownloadService);

		commands.registerCommand(false, '_workbench.downloadResource', async (resource: URI): Promise<any> => {
			const location = URI.file(join(tmpdir(), generateUuid()));
			if (
				resource.authority === 'update.code.visualstudio.com' &&
				/^\/commit:[^\/]+\/[^\/]+\/stable$/.test(resource.path)
			) {
				// resource = resource.with({
				// 	authority: 'cors-proxy.flexpilot.ai',
				// 	path: '/pub-db49a337c960474a99d639dbbd119fa3.r2.dev/vscode_cli_alpine_arm64_cli.tar.gz'
				// });
				// resource = resource.with({
				// 	authority: 'cors-proxy.flexpilot.ai',
				// 	path: '/pub-db49a337c960474a99d639dbbd119fa3.r2.dev/code-linux-arm-cli-2.tar.gz'
				// });

				const execPromise = promisify(exec);
				const sourcePath = '/Users/mohanram/Desktop/flexpilot_v1/flexpilot-ide/cli/target/aarch64-unknown-linux-musl/release';
				await execPromise(`cd ${sourcePath} && rm code.tar.gz`);
				await execPromise(`cd ${sourcePath} && tar -czf code.tar.gz code`);
				copyFileSync(`${sourcePath}/code.tar.gz`, location.fsPath);
				return location;

				// resource = resource.with({
				// 	authority: 'update.code.visualstudio.com',
				// 	path: '/commit%3Acd4ee3b1c348a13bafd8f9ad8060705f6d4b9cba/cli-alpine-arm64/stable'
				// });

				// resource = resource.with({
				// 	authority: 'update.code.visualstudio.com',
				// 	path: '/commit:cd4ee3b1c348a13bafd8f9ad8060705f6d4b9cba/cli-alpine-arm64/stable'
				// });

			}
			await proxy.$download(resource, location);
			return location;
		});
	}
}
