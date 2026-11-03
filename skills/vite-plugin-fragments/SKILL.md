---

name: vite-plugin-fragments
description: Use when a Vite project uses the vite-plugin-fragments plugin, or when the user wants to split index.html into reusable HTML partials with <load src="..." /> tags, pass arguments to partials with {=$name} placeholders, or configure the plugin's tagName, sourceAttr, replace.undefined or debug options.
---

# vite-plugin-fragments

Build-time and dev-time HTML includes for Vite. Each `<load />` tag in `index.html` is replaced by the content of the file it points to.

## Setup

```js
// vite.config.js
import { defineConfig } from 'vite';
import injectHTML from 'vite-plugin-fragments';

export default defineConfig({
	plugins: [injectHTML()],
});
```

## Usage

```html
<load src="src/html/header/branding.html" />
<load src="src/html/header" />
```

- The tag must be self-closing: `<load src="..." />`.
- Attribute values must use double quotes and cannot contain `"`.
- A `src` that is a file (ends in `.html` or `.htm`) is included as is.
- Any other `src` is a directory: the plugin includes its `index.html`, or `index.htm`.

## Paths

- `./` and `../` resolve from the folder of the file that contains the tag.
- Any other path resolves from the Vite `root`.
- Includes can be nested. A fragment can include other fragments.

## Arguments

Extra attributes on a tag become values for `{=$name}` placeholders in the fragment:

```html
<!-- index.html -->
<load src="src/card.html" title="Hello" />

<!-- src/card.html -->
<h2>{=$title}</h2>
```

Placeholders without a value stay as they are, unless `replace.undefined` is set.

## Options

```js
injectHTML({
	tagName: 'load', // tag to match
	sourceAttr: 'src', // attribute holding the path
	replace: { undefined: 'N/A' }, // replacement for placeholders without a value
	debug: { logPath: true }, // log every included file through the Vite logger
});
```

## Errors

- Missing file: the error names the `src`, the file that included it, and every path tried.
- Circular include: the error shows the include chain.
- Missing `src` attribute: the error names the file and the tag.

## Limitations

- Fragments are static. There are no loops or conditionals inside `<load />`. Use a template engine for logic.
- Matching uses a regular expression, not an HTML parser.
- Only HTML and text fragments are supported. Files are read as UTF-8.

## Checklist when editing a project that uses this plugin

1. Keep `<load />` tags self-closing with double-quoted attributes.
2. Use `./` for fragments next to the including file, and root-relative paths for shared fragments.
3. After changing a fragment, check the dev server reloads (HMR is a full reload for included files).
4. Run the build to confirm no `<load` remains in the output.
