import fs from 'node:fs';
import path from 'node:path';
import { normalizePath, type Plugin, type ResolvedConfig } from 'vite';

const attrNameExpr = '[a-z0-9_-]+';
const attrDataExpr = '[^"]*';

const attrMatcher = new RegExp(`(${attrNameExpr}|)="(${attrDataExpr})"`, 'gsi');
const replaceAttrMatcher = new RegExp(`{=\\$${attrNameExpr}}`, 'gsi');

function escapeRegExp(input: string) {
	return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type InjectHTMLConfig = {
	tagName?: string;
	sourceAttr?: string;
	replace?: { undefined?: string };
	debug?: { logPath?: boolean };
};

function injectHTML(pluginConfig?: InjectHTMLConfig): Plugin {
	const { tagName = 'load', sourceAttr = 'src', ...cfg } = { ...pluginConfig };

	let config: undefined | ResolvedConfig;

	const tagMatcher = new RegExp(
		`<${tagName}((?:\\s{1,}(${attrNameExpr}|)="${attrDataExpr}")+)\\s*/>`,
		'gsi',
	);

	const fileList = new Set<string>();

	/**
	 * @param currentFile Absolute path of the file `code` was read from.
	 *   Relative (`./`) sources resolve against its directory.
	 */
	async function renderSnippets(code: string, currentFile: string) {
		if (!config) {
			return code;
		}

		const matches = code.matchAll(tagMatcher);

		for (const match of matches) {
			const [tag, _attrs] = match;

			const attrs = new Map();
			for (const [, name, value] of _attrs.trim().matchAll(attrMatcher)) {
				attrs.set(name || sourceAttr, value);
			}

			const url = attrs.get(sourceAttr);

			if (typeof url !== 'string') {
				throw new Error(
					`injectHTML: Source attribute '${sourceAttr}' is missing in ${currentFile}:\n${tag}`,
				);
			}

			// Relative sources are relative to the including file,
			// everything else is relative to the project root.
			const baseDir = url.startsWith('.')
				? path.dirname(currentFile)
				: config.root;

			const target = path.resolve(baseDir, url);

			// Directories resolve to their index.html or index.htm.
			const candidates =
				target.endsWith('.htm') || target.endsWith('.html')
					? [target]
					: [path.join(target, 'index.html'), path.join(target, 'index.htm')];

			const found = candidates.find((candidate) => fs.existsSync(candidate));

			if (!found) {
				const tried = candidates.map((candidate) => `  - ${candidate}`);

				throw new Error(
					[
						`injectHTML: Could not find "${url}" included from ${currentFile}.`,
						'Tried:',
						...tried,
					].join('\n'),
				);
			}

			const filePath = normalizePath(found);
			if (pluginConfig?.debug?.logPath) {
				console.log('Trying to include ', filePath);
			}
			fileList.add(filePath);

			let data = fs.readFileSync(filePath, 'utf8');

			for (const [name, value] of attrs) {
				const attrRegExp = new RegExp(`{=\\$${escapeRegExp(name)}}`, 'gs');
				// ^ Node below version 15.0 has no .replaceAll()

				data = data.replace(attrRegExp, () => value);
			}

			const undefinedValue = cfg.replace?.undefined;
			if (undefinedValue) {
				data = data.replace(replaceAttrMatcher, () => undefinedValue);
			}

			const out = await renderSnippets(data, filePath);

			code = code.replace(tag, () => out);
		}

		return code;
	}

	return {
		name: 'vite-plugin-fragments',
		configResolved(resolvedConfig) {
			config = resolvedConfig;
		},
		handleHotUpdate({ file, server }) {
			if (fileList.has(file)) {
				server.ws.send({
					type: 'full-reload',
					path: '*',
				});
			}
		},
		transformIndexHtml: {
			order: 'pre',
			handler(html, ctx) {
				return renderSnippets(html, ctx.filename);
			},
		},
	};
}

export default injectHTML;
