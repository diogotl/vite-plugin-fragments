---

## "vite-plugin-fragments": minor

- Include files with any extension (for example `.svg` or `.md`), and `.HTML` in upper case. A path that is a file is used as is; a directory resolves to its `index.html` or `index.htm`.
- New option `warn.unresolvedPlaceholders` to warn about `{=$name}` placeholders that receive no value.
