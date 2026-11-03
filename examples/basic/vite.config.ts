import { defineConfig } from 'vite';
import injectHTML from '../../src/index.ts';

export default defineConfig({
	plugins: [injectHTML()],
});
