import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/codemode/index.ts'],
  format: ['esm'],
  clean: true,
  dts: true,
  fixedExtension: false,
})
