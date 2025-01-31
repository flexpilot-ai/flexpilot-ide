/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Flexpilot AI. All rights reserved.
 *  Licensed under the GPL-3.0 License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILanguageConfig } from './types';

/**
 * Defines the various locations or contexts where AI assistance is provided.
 */
export const LOCATIONS = [
	{
		name: 'Rename Symbol',
		id: 'rename-symbol',
		description: 'Automatically rename symbols in the code',
	},
	{
		name: 'Chat Suggestions',
		id: 'chat-suggestions',
		description: 'Suggestions that appear in the panel chat',
	},
	{
		name: 'Chat Title',
		id: 'chat-title',
		description: 'Dynamically generated title for the chat',
	},
	{
		name: 'Commit Message',
		id: 'commit-message',
		description: 'Used to generate commit messages for source control',
	}
] as const;

/**
 * The default temperature value for the chat model.
 */
export const DEFAULT_MODEL_PARAMS = {
	temperature: 0.2
} as const;

/**
 * A mapping of language IDs to their respective configurations.
 */
export const LANGUAGES: { [key: string]: ILanguageConfig } = {
	abap: {
		markdown: 'abap',
		comment: { start: '* ', end: ' */' },
	},
	bibtex: {
		markdown: 'bibtex',
		comment: { start: '% ', end: '' },
	},
	d: {
		markdown: 'd',
		comment: { start: '/* ', end: ' */' },
	},
	pascal: {
		markdown: 'pascal',
		comment: { start: '{ ', end: ' }' },
	},
	erlang: {
		markdown: 'erlang',
		comment: { start: '%% ', end: ' %%' },
	},
	haml: {
		markdown: 'haml',
		comment: { start: '-# ', end: ' -#' },
	},
	haskell: {
		markdown: 'haskell',
		comment: { start: '{- ', end: ' -}' },
	},
	ocaml: {
		markdown: 'ocaml',
		comment: { start: '(* ', end: ' *)' },
	},
	perl6: {
		markdown: 'perl6',
		comment: { start: '/* ', end: ' */' },
	},
	sass: {
		markdown: 'scss',
		comment: { start: '/* ', end: ' */' },
	},
	slim: {
		markdown: 'slim',
		comment: { start: '/ ', end: '' },
	},
	stylus: {
		markdown: 'stylus',
		comment: { start: '// ', end: '' },
	},
	svelte: {
		markdown: 'svelte',
		comment: { start: '/* ', end: ' */' },
	},
	vue: {
		markdown: 'vue',
		comment: { start: '/* ', end: ' */' },
	},
	'vue-html': {
		markdown: 'html',
		comment: { start: '<!-- ', end: ' -->' },
	},
	razor: {
		markdown: 'razor',
		comment: { start: '<!-- ', end: ' -->' },
	},
	shaderlab: {
		markdown: 'shader',
		comment: { start: '/* ', end: ' */' },
	},
	dockerfile: {
		markdown: 'dockerfile',
		comment: { start: '# ', end: '' },
	},
	go: {
		markdown: 'go',
		comment: { start: '/* ', end: ' */' },
	},
	python: {
		markdown: 'py',
		comment: { start: '\'\'\' ', end: ' \'\'\'' },
	},
	css: {
		markdown: 'css',
		comment: { start: '/* ', end: ' */' },
	},
	clojure: {
		markdown: 'clj',
		comment: { start: ';; ', end: '' },
	},
	less: {
		markdown: 'less',
		comment: { start: '/* ', end: ' */' },
	},
	dart: {
		markdown: 'dart',
		comment: { start: '/* ', end: ' */' },
	},
	tex: {
		markdown: 'tex',
		comment: { start: '% ', end: '' },
	},
	latex: {
		markdown: 'latex',
		comment: { start: '% ', end: '' },
	},
	scss: {
		markdown: 'scss',
		comment: { start: '/* ', end: ' */' },
	},
	perl: {
		markdown: 'pl',
		comment: { start: '# ', end: '' },
	},
	raku: {
		markdown: 'raku',
		comment: { start: '# ', end: '' },
	},
	rust: {
		markdown: 'rs',
		comment: { start: '/* ', end: ' */' },
	},
	jade: {
		markdown: 'pug',
		comment: { start: '//- ', end: '' },
	},
	fsharp: {
		markdown: 'fs',
		comment: { start: '(* ', end: ' *)' },
	},
	r: {
		markdown: 'r',
		comment: { start: '# ', end: '' },
	},
	java: {
		markdown: 'java',
		comment: { start: '/* ', end: ' */' },
	},
	diff: {
		markdown: 'diff',
		comment: { start: '# ', end: ' ' },
	},
	html: {
		markdown: 'html',
		comment: { start: '<!-- ', end: ' -->' },
	},
	php: {
		markdown: 'php',
		comment: { start: '/* ', end: ' */' },
	},
	lua: {
		markdown: 'lua',
		comment: { start: '--[[ ', end: ' ]]' },
	},
	xml: {
		markdown: 'xml',
		comment: { start: '<!-- ', end: ' -->' },
	},
	xsl: {
		markdown: 'xsl',
		comment: { start: '<!-- ', end: ' -->' },
	},
	vb: {
		markdown: 'vb',
		comment: { start: '\' ', end: '' },
	},
	powershell: {
		markdown: 'ps1',
		comment: { start: '<# ', end: ' #>' },
	},
	typescript: {
		markdown: 'ts',
		comment: { start: '/* ', end: ' */' },
	},
	typescriptreact: {
		markdown: 'tsx',
		comment: { start: '/* ', end: ' */' },
	},
	ini: {
		markdown: 'ini',
		comment: { start: '; ', end: ' ' },
	},
	properties: {
		markdown: 'conf',
		comment: { start: '# ', end: ' ' },
	},
	json: {
		markdown: 'json',
		comment: { start: '/* ', end: ' */' },
	},
	jsonc: {
		markdown: 'jsonc',
		comment: { start: '/* ', end: ' */' },
	},
	jsonl: {
		markdown: 'jsonl',
		comment: { start: '/* ', end: ' */' },
	},
	snippets: {
		markdown: 'code-snippets',
		comment: { start: '/* ', end: ' */' },
	},
	'git-commit': {
		markdown: 'git-commit',
		comment: { start: '# ', end: ' ' },
	},
	'git-rebase': {
		markdown: 'git-rebase',
		comment: { start: '# ', end: ' ' },
	},
	ignore: {
		markdown: 'gitignore_global',
		comment: { start: '# ', end: '' },
	},
	handlebars: {
		markdown: 'handlebars',
		comment: { start: '{{!-- ', end: ' --}}' },
	},
	c: {
		markdown: 'c',
		comment: { start: '/* ', end: ' */' },
	},
	cpp: {
		markdown: 'cpp',
		comment: { start: '/* ', end: ' */' },
	},
	'cuda-cpp': {
		markdown: 'cpp',
		comment: { start: '/* ', end: ' */' },
	},
	swift: {
		markdown: 'swift',
		comment: { start: '/* ', end: ' */' },
	},
	makefile: {
		markdown: 'mak',
		comment: { start: '# ', end: '' },
	},
	shellscript: {
		markdown: 'sh',
		comment: { start: '# ', end: '' },
	},
	markdown: {
		markdown: 'md',
		comment: { start: '<!-- ', end: ' -->' },
	},
	dockercompose: {
		markdown: 'dockercompose',
		comment: { start: '# ', end: '' },
	},
	yaml: {
		markdown: 'yaml',
		comment: { start: '# ', end: '' },
	},
	csharp: {
		markdown: 'cs',
		comment: { start: '/* ', end: ' */' },
	},
	julia: {
		markdown: 'jl',
		comment: { start: '#= ', end: ' =#' },
	},
	bat: {
		markdown: 'bat',
		comment: { start: '@REM ', end: '' },
	},
	groovy: {
		markdown: 'groovy',
		comment: { start: '/* ', end: ' */' },
	},
	coffeescript: {
		markdown: 'coffee',
		comment: { start: '### ', end: ' ###' },
	},
	javascriptreact: {
		markdown: 'jsx',
		comment: { start: '/* ', end: ' */' },
	},
	javascript: {
		markdown: 'js',
		comment: { start: '/* ', end: ' */' },
	},
	'jsx-tags': {
		markdown: 'jsx-tags',
		comment: { start: '{/* ', end: ' */}' },
	},
	hlsl: {
		markdown: 'hlsl',
		comment: { start: '/* ', end: ' */' },
	},
	restructuredtext: {
		markdown: 'rst',
		comment: { start: '.. ', end: '' },
	},
	'objective-c': {
		markdown: 'm',
		comment: { start: '/* ', end: ' */' },
	},
	'objective-cpp': {
		markdown: 'cpp',
		comment: { start: '/* ', end: ' */' },
	},
	ruby: {
		markdown: 'rb',
		comment: { start: '=begin ', end: ' =end' },
	},
	sql: {
		markdown: 'sql',
		comment: { start: '/* ', end: ' */' },
	},
};
