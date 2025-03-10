import { build } from 'esbuild';

// Run the build
build({
  entryPoints: ['src/lambdaEntrypoint.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'dist/lambda/index.js',
  external: ['aws-sdk', 'sharp'],
  sourcemap: true,
  sourcesContent: false,
})
  .then(() => console.log('⚡ Lambda bundle built successfully!'))
  .catch((error) => {
    console.error('❌ Error building Lambda bundle:', error);
    process.exit(1);
  }); 