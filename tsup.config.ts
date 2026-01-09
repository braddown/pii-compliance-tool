import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'components/index': 'src/components/index.ts',
    'api/index': 'src/api/index.ts',
    'hooks/index': 'src/hooks/index.ts',
    'types/index': 'src/types/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', 'next', '@supabase/supabase-js'],
  treeshake: true,
  minify: false,
});
