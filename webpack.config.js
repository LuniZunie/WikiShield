const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  return {
    mode: isDev ? 'development' : 'production',
    entry: './src/index.js',
    output: {
      filename: isDev ? 'build.js' : 'wikishield.js',
      path: path.resolve(__dirname, 'dist'),
      clean: true,
      pathinfo: false, // Faster builds
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true, // Enable caching for faster rebuilds
              cacheCompression: false, // Faster caching
            }
          }
        }
      ]
    },
    resolve: {
      extensions: ['.js', '.jsx'],
      alias: {
        'react': 'preact/compat',
        'react-dom': 'preact/compat',
        'react/jsx-runtime': 'preact/jsx-runtime'
      }
    },
    devtool: isDev ? 'eval-cheap-module-source-map' : false,
    optimization: {
      minimize: !isDev,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: false, // Keep console for userscript debugging
              drop_debugger: true,
              pure_funcs: isDev ? [] : ['console.debug'], // Remove debug logs in prod
            },
            mangle: true,
            format: {
              comments: false, // Remove comments in production
            },
          },
          extractComments: false,
        }),
      ],
      moduleIds: 'deterministic', // Better long-term caching
      runtimeChunk: false, // Single bundle for userscript
      splitChunks: false, // Keep everything in one file for userscript
      usedExports: true, // Tree shaking
      sideEffects: true,
    },
    performance: {
      hints: isDev ? false : 'warning',
      maxEntrypointSize: 512000, // 500kb warning
      maxAssetSize: 512000,
    },
    cache: {
      type: 'filesystem', // Faster rebuilds with disk cache
      cacheDirectory: path.resolve(__dirname, '.webpack-cache'),
    },
    stats: isDev ? 'minimal' : 'normal',
    devServer: {
      port: 8080,
      static: {
        directory: path.join(__dirname, 'dist'),
      },
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'
      },
      hot: false, // Disable HMR since we're using eval() reload
      liveReload: false, // We'll handle reload via fetch
      compress: true,
      client: {
        logging: 'error', // Cleaner console output
        overlay: {
          errors: true,
          warnings: false,
        },
      },
    },
    watchOptions: {
      ignored: /node_modules/,
      aggregateTimeout: 300, // Debounce rebuilds
    },
  };
};