# vite-plugin-fragments

[![npm](https://img.shields.io/npm/dt/vite-plugin-fragments?style=for-the-badge)](https://www.npmjs.com/package/vite-plugin-fragments) ![GitHub Repo stars](https://img.shields.io/github/stars/diogotl/vite-plugin-fragments?label=GitHub%20Stars&style=for-the-badge) [![GitHub](https://img.shields.io/github/license/diogotl/vite-plugin-fragments?color=blue&style=for-the-badge)](https://github.com/diogotl/vite-plugin-fragments/blob/master/LICENSE)
![GitHub last commit](https://img.shields.io/github/last-commit/diogotl/vite-plugin-fragments?style=for-the-badge) [![Issues](https://img.shields.io/github/issues/diogotl/vite-plugin-fragments?style=for-the-badge)](https://github.com/diogotl/vite-plugin-fragments/issues)

Split your `index.html` into smaller, reusable HTML fragments. The plugin inlines them at build time and during development, so you get the benefits of partials without a framework.

> Fork of [donnikitos/vite-plugin-html-inject](https://github.com/donnikitos/vite-plugin-html-inject) (MIT). See [Credits](#credits).

## Contents

- [Installation](#installation)
- [Usage](#usage)
- [Passing arguments](#passing-arguments-to-fragments)
- [How paths are resolved](#how-paths-are-resolved)
- [Options](#options)
- [Limitations](#limitations)
- [Debugging](#debugging)
- [Credits](#credits)

## Installation

```sh
npm install --save-dev vite-plugin-fragments
# or
pnpm add -D vite-plugin-fragments
```

Then register the plugin in your Vite config:

```js
// vite.config.js
import { defineConfig } from 'vite';
import injectHTML from 'vite-plugin-fragments';

export default defineConfig({
	plugins: [injectHTML()],
});
```

## Usage

Replace shared markup in `index.html` with `<load />` tags. Each tag points to a file or to a directory that contains an `index.html` (or `index.htm`).

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	</head>
	<body>
		<!-- Loads the specified file -->
		<load src="src/html/header/branding.html" />
		<!-- Loads src/html/header/index.html (or index.htm) -->
		<load src="src/html/header" />
		<div>
			<load src="src/html/body/sidebar.html" />
			<load src="src/html/body" />
		</div>
		<load src="src/html/footer" />
	</body>
</html>
```

A fragment is plain HTML. It can contain its own `<load />` tags:

```html
<!-- src/html/body/sidebar.html -->
<aside>
	<load src="./nav.html" />
</aside>
```

## Passing arguments to fragments

Any extra attribute on a `<load />` tag becomes a value you can insert into the fragment with `{=$name}`. This lets you reuse the same markup in several places.

```html
<!-- index.html -->
<div class="some-cool-menu">
	<load
		src="src/some-static-link.htm"
		label="Go to DuckDuckGo"
		href="https://duckduckgo.com/"
	/>
	<load src="src/some-static-link.htm" label="Go to Google" href="https://google.com" />
</div>
```

```html
<!-- src/some-static-link.htm -->
<a href="{=$href}" class="some-cool-link-style">{=$label}</a>
```

The generated HTML is:

```html
<div class="some-cool-menu">
	<a href="https://duckduckgo.com/" class="some-cool-link-style">Go to DuckDuckGo</a>
	<a href="https://google.com" class="some-cool-link-style">Go to Google</a>
</div>
```

Placeholders with no matching attribute are left as they are, unless you set [`replace.undefined`](#options).

## How paths are resolved

| `src` starts with | Resolved against                                               | Example                                  |
| ----------------- | -------------------------------------------------------------- | ---------------------------------------- |
| `./` or `../`     | The folder of the file that contains the `<load />` tag        | `src="./nav.html"` inside `sidebar.html` |
| anything else     | The Vite [`root`](https://vite.dev/config/shared-options#root) | `src="src/html/footer"`                  |

If the path does not end in `.html` or `.htm`, the plugin looks for `index.html` and then `index.htm` inside that folder.

Includes can be nested. Relative paths always resolve from the file that contains them, so a fragment can be moved to another folder together with its own relative includes.

## Options

```js
injectHTML({
	tagName: 'loader', // Default: 'load'
	sourceAttr: 'file', // Default: 'src'
	replace: {
		undefined: 'N/A', // Replace placeholders that received no value. Default: keep them
	},
	debug: {
		logPath: true, // Log every file that is included. Default: false
	},
});
```

With the options above you write:

```html
<loader file="src/some-static-link.htm" label="Go to DuckDuckGo" href="https://duckduckgo.com/" />
```

## Limitations

The plugin matches tags with a regular expression, not a full HTML parser. Keep these rules in mind:

- Tags must be self-closing: `<load src="..." />`.
- Attribute values must use double quotes and cannot contain `"`.
- Every `<load />` tag needs a `src` (or your custom `sourceAttr`).
- Fragments are static: `<load />` cannot contain loops or conditions. Use a template engine if you need logic.

## Debugging

If a file is not found, turn on path logging to see where the plugin looks:

```js
injectHTML({
	debug: {
		logPath: true,
	},
});
```

## Credits

vite-plugin-fragments is a fork of [vite-plugin-html-inject](https://github.com/donnikitos/vite-plugin-html-inject) by [Nikita 'donnikitos' Nitichevski](https://donnikitos.com/), released under the MIT license. The original project is the work of its author; please support it there.

Changes in this fork include fixes for `$` patterns in attribute values and fragments, relative include resolution, a Vitest test suite, Biome, pnpm and updated dependencies.

## License

[MIT](LICENSE)
