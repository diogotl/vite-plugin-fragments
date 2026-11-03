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

type InjectHTMLConfig = {
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

	async function renderSnippets(code: string, codePath: string) {
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

			let url = attrs.get(sourceAttr);

			if (typeof url !== 'string') {
				throw new Error(
					`injectHTML: Source attribute '${sourceAttr}' missing in\r\n${tag}`,
				);
			}

			let root = config.root;

			if (url.startsWith('.')) {
				root = path.dirname(root + codePath);
			} else {
				url = `/${url}`;
			}

			if (!(url.endsWith('.htm') || url.endsWith('.html'))) {
				for (const item of ['html', 'htm']) {
					const fileName = `/index.${item}`;

					const filePath = normalizePath(path.join(root, url, fileName));

					if (fs.existsSync(filePath)) {
						url += fileName;

						break;
					}
				}
			}

			const filePath = normalizePath(path.join(root, url));
			if (pluginConfig?.debug?.logPath) {
				console.log('Trying to include ', filePath);
			}
			fileList.add(filePath);

			let out = tag;
			try {
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

				out = await renderSnippets(data, url);
			} catch (error) {
				if (error instanceof Error) {
					throw new Error(`injectHTML: ${error.message}`);
				}
				throw new Error(`${error}`);
			}

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
				return renderSnippets(html, ctx.path);
			},
		},
	};
}

export default injectHTML;
