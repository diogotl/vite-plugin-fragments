import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
	normalizePath,
	type Plugin,
	type ResolvedConfig,
	type ViteDevServer,
} from 'vite';

type HotUpdateContext = { file: string; server: ViteDevServer };

const attrNameExpr = '[a-z0-9_-]+';
const attrDataExpr = '[^"]*';

const attrMatcher = new RegExp(`(${attrNameExpr}|)="(${attrDataExpr})"`, 'gsi');
const replaceAttrMatcher = new RegExp(`{=\\$${attrNameExpr}}`, 'gsi');

async function isFile(file: string) {
	try {
		return (await stat(file)).isFile();
	} catch {
		return false;
	}
}

function escapeRegExp(input: string) {
	return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type InjectHTMLConfig = {
	tagName?: string;
	sourceAttr?: string;
	replace?: { undefined?: string };
	debug?: { logPath?: boolean };
	warn?: { unresolvedPlaceholders?: boolean };
};

function injectHTML(pluginConfig?: InjectHTMLConfig): Plugin {
	const { tagName = 'load', sourceAttr = 'src', ...cfg } = { ...pluginConfig };

	let config: undefined | ResolvedConfig;

	const tagMatcher = new RegExp(
		`<${tagName}((?:\\s{1,}(${attrNameExpr}|)="${attrDataExpr}")+)\\s*/>`,
		'gsi',
	);

	const fileList = new Set<string>();

	function reloadIfIncluded({ file, server }: HotUpdateContext) {
		if (fileList.has(file)) {
			server.ws.send({
				type: 'full-reload',
				path: '*',
			});
		}
	}

	/**
	 * @param currentFile Absolute path of the file `code` was read from.
	 *   Relative (`./`) sources resolve against its directory.
	 * @param chain Files that led to `currentFile`, used to detect cycles.
	 */
	async function renderSnippets(
		code: string,
		currentFile: string,
		chain: string[] = [],
	): Promise<string> {
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

			// A file is used as is. A directory resolves to its index.html or index.htm.
			const candidates = [
				target,
				path.join(target, 'index.html'),
				path.join(target, 'index.htm'),
			];

			let found: string | undefined;
			for (const candidate of candidates) {
				if (await isFile(candidate)) {
					found = candidate;
					break;
				}
			}

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

			if (chain.includes(filePath) || filePath === normalizePath(currentFile)) {
				throw new Error(
					[
						`injectHTML: Circular include of ${filePath}.`,
						'Include chain:',
						...[...chain, currentFile, filePath].map((file) => `  - ${file}`),
					].join('\n'),
				);
			}

			if (pluginConfig?.debug?.logPath) {
				config.logger.info(`[vite-plugin-fragments] Including ${filePath}`);
			}
			fileList.add(filePath);

			let data = await readFile(filePath, 'utf8');

			for (const [name, value] of attrs) {
				const attrRegExp = new RegExp(`{=\\$${escapeRegExp(name)}}`, 'gs');
				// ^ Node below version 15.0 has no .replaceAll()

				data = data.replace(attrRegExp, () => value);
			}

			const undefinedValue = cfg.replace?.undefined;
			if (undefinedValue) {
				data = data.replace(replaceAttrMatcher, () => undefinedValue);
			}

			if (cfg.warn?.unresolvedPlaceholders && !undefinedValue) {
				for (const [placeholder] of data.matchAll(replaceAttrMatcher)) {
					config.logger.warn(
						`[vite-plugin-fragments] No value for ${placeholder} in ${filePath} (included from ${currentFile})`,
					);
				}
			}

			const out = await renderSnippets(data, filePath, [...chain, currentFile]);

			code = code.replace(tag, () => out);
		}

		return code;
	}

	return {
		name: 'vite-plugin-fragments',
		configResolved(resolvedConfig) {
			config = resolvedConfig;
		},
		// Vite 6+ uses `hotUpdate` and ignores `handleHotUpdate` when both exist.
		// `handleHotUpdate` is kept for Vite 5.
		handleHotUpdate: reloadIfIncluded,
		hotUpdate: reloadIfIncluded,
		transformIndexHtml: {
			order: 'pre',
			handler(html, ctx) {
				return renderSnippets(html, ctx.filename, []);
			},
		},
	};
}

export default injectHTML;
