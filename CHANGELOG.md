# vite-plugin-fragments

## 1.3.0

### Minor Changes

- 7552519: - Include files with any extension (for example `.svg` or `.md`), and `.HTML` in upper case. A path that is a file is used as is; a directory resolves to its `index.html` or `index.htm`.
  - New option `warn.unresolvedPlaceholders` to warn about `{=$name}` placeholders that receive no value.

## 1.2.0

### Minor Changes

- First release under the `vite-plugin-fragments` name, a fork of `vite-plugin-html-inject`.
  
  - Fix `$` patterns in attribute values, `replace.undefined` and fragment content being interpreted as replacement patterns.
  - Resolve `./` and `../` includes relative to the file that contains them.
  - Clearer errors: missing sources name the including file, and missing files list every path tried.
  - Export the `InjectHTMLConfig` type.
  - Migrate to pnpm, update dependencies (Vite 8, Vitest 5, unbuild 3) and drop the Vite < 4 compatibility code.
  - Add a Vitest test suite and Biome for linting and formatting.
