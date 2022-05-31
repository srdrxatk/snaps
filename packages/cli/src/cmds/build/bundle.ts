import browserify, { BrowserifyObject } from 'browserify';
import { TranspilationModes } from '../../builders';
import { YargsArgs } from '../../types/yargs';
import { processDependencies, writeBundleFile } from './utils';

// We need to statically import all Browserify transforms and all Babel presets
// and plugins, and calling `require` is the sanest way to do that.
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, node/global-require */

/**
 * Builds a Snap bundle JS file from its JavaScript source.
 *
 * @param src - The source file path.
 * @param dest - The destination file path.
 * @param argv - arguments as an object generated by yargs.
 * @param argv.sourceMaps - Whether to output sourcemaps.
 * @param argv.stripComments - Whether to remove comments from code.
 * @param argv.transpilationMode - The Babel transpilation mode.
 * @param bundlerTransform
 */
export function bundle(
  src: string,
  dest: string,
  argv: YargsArgs,
  bundlerTransform?: (bundler: BrowserifyObject) => void,
): Promise<boolean> {
  const { sourceMaps: debug, transpilationMode } = argv;
  const babelifyOptions = processDependencies(argv as any);
  return new Promise((resolve, _reject) => {
    const bundler = browserify(src, {
      debug,
      // Standalone is required to properly support Snaps using module.exports
      standalone: '<snap>',
    });

    if (transpilationMode !== TranspilationModes.none) {
      bundler.transform(require('babelify'), {
        global: transpilationMode === TranspilationModes.localAndDeps,
        extensions: ['.js', '.ts'],
        presets: [
          require('@babel/preset-typescript'),
          [
            require('@babel/preset-env'),
            {
              targets: {
                browsers: ['chrome >= 66', 'firefox >= 68'],
              },
            },
          ],
        ],
        plugins: [
          require('@babel/plugin-transform-runtime'),
          require('@babel/plugin-proposal-class-properties'),
          require('@babel/plugin-proposal-object-rest-spread'),
          require('@babel/plugin-proposal-optional-chaining'),
          require('@babel/plugin-proposal-nullish-coalescing-operator'),
        ],
        ...(babelifyOptions as any),
      });
    }

    bundlerTransform?.(bundler);

    bundler.plugin('@metamask/snaps-browserify-plugin', {
      stripComments: argv.stripComments,
      transformHtmlComments: argv.transformHtmlComments,
    });

    bundler.bundle(
      async (bundleError, bundleBuffer: Buffer) =>
        await writeBundleFile({
          bundleError,
          bundleBuffer,
          src,
          dest,
          resolve,
        }),
    );
  });
}
