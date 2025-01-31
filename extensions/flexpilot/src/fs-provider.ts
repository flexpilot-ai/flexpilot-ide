/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { fs } from 'memfs';
import path from 'path';
import Dirent from 'memfs/lib/Dirent';
import { Buffer } from 'buffer';
import { corsEnableUrl, getGitHubSession } from './utilities';
import { registerDisposable } from './context';
import { logger } from './logger';

// Interface for the GitHub tree response
interface GitTree {
	truncated: boolean;
	sha: string;
	tree: Array<{ path: string; type: string }>;
}

// Define the UID for the real and dummy files
enum FileUID { Real = 1, Dummy = 2 }

/**
 * Implementation of the file system provider for the GitHub repository
 */
export class GitHubFileSystemProvider implements vscode.FileSystemProvider, vscode.FileSearchProvider, vscode.TextSearchProvider {

	private emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	public repository!: { owner: string; name: string; branch: string; uri: vscode.Uri };

	async initializeRepository(uri: vscode.Uri): Promise<void | Thenable<void>> {
		logger.info(`Initializing repository for URI: ${uri.toString()}`);
		// Create the base directory for the repository
		this.createDirectory(uri);

		// Get the GitHub authentication session if it exists
		const githubSession = await getGitHubSession();

		// Set the repository owner, name, and branch
		const [owner, repo, branch] = uri.path.split('/').filter(item => item.trim());
		this.repository = { owner, name: repo, branch: branch, uri: uri };

		// Set the request headers for the GitHub API
		const requestHeader: Record<string, string> = {
			'X-GitHub-Api-Version': '2022-11-28',
			'Accept': 'application/vnd.github+json'
		};
		if (githubSession) {
			requestHeader['Authorization'] = `Bearer ${githubSession.accessToken}`;
		}

		// Fetch the repository tree from the GitHub API
		const response = await fetch(
			`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=true`,
			{ headers: requestHeader }
		);

		// Show an error message if the request fails
		if (!response.ok) {
			logger.notifyError('Failed to fetch repository: ' + await response.text());
			return;
		}

		// Parse the response and set the branch
		const responseJson: GitTree = await response.json();

		// Show an error message if the tree is too large to be fetched
		if (responseJson.truncated) {
			logger.notifyError('Repository tree is truncated due to size');
			return;
		}

		// Create the directories and files in the file system provider
		responseJson.tree.forEach(item => {
			if (item.path) {

				// Create the file URI for the item
				const fileUri = uri.with({ path: `${uri.path}/${item.path}` });

				// If the item is a tree, create a directory
				if (item.type === 'tree') {
					fs.mkdirSync(fileUri.path, { recursive: true });
				}

				// If the item is a blob, create a file
				else if (item.type === 'blob') {
					fs.mkdirSync(path.dirname(fileUri.path), { recursive: true });
					fs.writeFileSync(fileUri.path, '', { flag: 'w' });
					fs.chownSync(fileUri.path, FileUID.Dummy, FileUID.Dummy);
				}

				// Show the README file in the preview if it exists
				if (item.path.toLowerCase().trim() === 'readme.md') {
					vscode.commands.executeCommand('markdown.showPreview', fileUri);
				}
			}
		});
	}

	provideTextSearchResults(): vscode.ProviderResult<vscode.TextSearchComplete> {
		logger.warn('Text search not supported in web version');
		// Show an error message and open link to download the desktop version
		vscode.window.showErrorMessage(
			'Text search is not supported in web version, please use the desktop version',
			'Get Desktop Version'
		).then(value => {
			if (value === 'Get Desktop Version') {
				vscode.env.openExternal(vscode.Uri.parse('https://flexpilot.ai/'));
			}
		});
		return null;
	}

	provideFileSearchResults(query: vscode.FileSearchQuery): vscode.ProviderResult<vscode.Uri[]> {
		// Get the list of files in the repository
		const fileList = fs.readdirSync('/', {
			recursive: true, withFileTypes: true, encoding: 'utf-8'
		});

		const searchResults: vscode.Uri[] = [];
		for (const file of fileList) {
			// File must have file types since withFileTypes is true
			if (!(file instanceof Dirent)) {
				continue;
			}
			// File name must be a string since encoding is 'utf-8'
			else if (typeof file.name !== 'string') {
				continue;
			}
			// Skip anything that is not a file
			else if (!file.isFile()) {
				continue;
			}
			// Skip anything that does not match the search pattern
			else if (!file.name.includes(query.pattern)) {
				continue;
			}
			// Skip if the repository URI is not set
			else if (!this.repository.uri) {
				continue;
			}

			// Add the file URI to the search results
			searchResults.push(
				this.repository.uri.with({ path: path.join(file.path, file.name) })
			);
		}
		return searchResults;
	}

	readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this.emitter.event;

	watch(): vscode.Disposable {
		return new vscode.Disposable(() => { });
	}

	stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
		// Check if the file exists in the file system
		if (!fs.existsSync(uri.fsPath)) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}

		// Get the file stats and return the file stat object
		const stat = fs.statSync(uri.fsPath);
		const fileStat: vscode.FileStat = {
			ctime: stat.ctimeMs,
			size: stat.size,
			mtime: stat.mtimeMs,
			type: stat.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File,
		};
		return fileStat;
	}

	readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
		// Check if the directory exists in the file system
		if (!fs.existsSync(uri.fsPath)) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}

		// Get the list of entries in the directory and return the output
		const entries = fs.readdirSync(
			uri.path, { withFileTypes: true, recursive: false, encoding: 'utf-8' }
		);
		const output: [string, vscode.FileType][] = [];

		// Add the entries to the output array with the file type
		for (const entry of entries) {
			if (entry instanceof Dirent && typeof entry.name === 'string') {
				if (entry.isDirectory()) {
					output.push([entry.name, vscode.FileType.Directory]);
				} else {
					output.push([entry.name, vscode.FileType.File]);
				}
			}
		}
		return output;
	}

	createDirectory(uri: vscode.Uri): void | Thenable<void> {
		// Create the directory if it does not exist in the file system
		if (!fs.existsSync(uri.fsPath)) {
			fs.mkdirSync(uri.fsPath, { recursive: true });
		}

		// Emit the file change event
		this.emitter.fire([{ type: vscode.FileChangeType.Created, uri }]);
	}

	async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		// Check if the file exists in the file system
		if (!fs.existsSync(uri.fsPath)) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}

		// Fetch the file from the GitHub API if it is not a real file
		if (fs.statSync(uri.fsPath).uid !== FileUID.Real) {
			const originalUrl = `https://raw.githubusercontent.com${uri.path}`;
			const originalStats = fs.statSync(uri.fsPath);
			const response = await fetch(corsEnableUrl(originalUrl));
			fs.writeFileSync(uri.fsPath, Buffer.from(await response.arrayBuffer()));
			fs.chownSync(uri.fsPath, FileUID.Real, FileUID.Real);
			fs.utimesSync(uri.fsPath, originalStats.atime, originalStats.mtime);
		}

		// Read the file content and return it as a Uint8Array
		const content = fs.readFileSync(uri.fsPath, { encoding: 'buffer' });
		if (content instanceof Buffer) {
			return new Uint8Array(content.buffer);
		}
		throw vscode.FileSystemError.Unavailable(uri);
	}

	writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): void | Thenable<void> {
		// Check if the file exists in the file system
		const exists = fs.existsSync(uri.fsPath);

		// Check if the file can be created or overwritten
		if (!exists && !options.create) {
			throw vscode.FileSystemError.FileNotFound(uri);
		} else if (exists && !options.overwrite) {
			throw vscode.FileSystemError.FileExists(uri);
		}

		// Write the file content to the file system
		fs.writeFileSync(uri.fsPath, content);
		fs.chownSync(uri.fsPath, FileUID.Real, FileUID.Real);

		// Emit the file change event based on the file status
		if (!exists) {
			this.emitter.fire([{ type: vscode.FileChangeType.Created, uri }]);
		} else {
			this.emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
		}
	}

	delete(uri: vscode.Uri, options: { recursive: boolean }): void | Thenable<void> {
		// Check if the file exists in the file system
		if (!fs.existsSync(uri.fsPath)) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}

		// Delete the file or directory based on the recursive option
		const stat = fs.statSync(uri.fsPath);
		if (stat.isDirectory()) {
			fs.rmdirSync(uri.fsPath, { recursive: !!options.recursive });
		} else {
			fs.unlinkSync(uri.fsPath);
		}

		// Emit the file change event based on the file status
		this.emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
	}

	rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void | Thenable<void> {
		// Check if the old file exists in the file system
		const exists = fs.existsSync(newUri.fsPath);

		// Rename the file if it exists and overwrite is enabled
		if (exists && !options.overwrite) {
			throw vscode.FileSystemError.FileExists(newUri);
		} else if (!fs.existsSync(oldUri.fsPath)) {
			throw vscode.FileSystemError.FileNotFound(oldUri);
		}

		// Rename the file in the file system
		fs.renameSync(oldUri.fsPath, newUri.fsPath);

		// Emit the file change event based on the file status
		this.emitter.fire([
			{ type: vscode.FileChangeType.Deleted, uri: oldUri },
			{ type: vscode.FileChangeType.Created, uri: newUri }
		]);
	}
}

export const handleGitHubFileSystemProvider = async (uri: vscode.Uri) => {
	// Create the file system provider and initialize the repository
	const fileSystemProvider = new GitHubFileSystemProvider();
	await fileSystemProvider.initializeRepository(uri);

	// Register the file system provider with the workspace
	registerDisposable(
		vscode.workspace.registerFileSystemProvider('web-fs', fileSystemProvider)
	);
	logger.info('File system provider registered');

	// Register the file search provider with the workspace
	registerDisposable(
		vscode.workspace.registerFileSearchProvider('web-fs', fileSystemProvider)
	);
	logger.info('File search provider registered');

	// Register the text search provider with the workspace
	registerDisposable(
		vscode.workspace.registerTextSearchProvider('web-fs', fileSystemProvider)
	);
	logger.info('Text search provider registered');

	// Show a message to inform the user about virtual file system
	vscode.commands.executeCommand('flexpilot.vfs.info.message');
};
