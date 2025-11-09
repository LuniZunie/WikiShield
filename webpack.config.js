const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';
  const isReadable = process.env.READABLE === 'true'; // Unminified production build

  return {
    mode: isDev ? 'development' : 'production',
    entry: './src/index.js',
    output: {
      filename: isDev ? 'build.js' : 'wikishield.js',
      path: path.resolve(__dirname, 'dist'),
      clean: true,
      pathinfo: isDev || isReadable, // Include module info in dev and readable builds
      environment: {
        // Ensure proper string escaping in output
        arrowFunction: false,
        const: false,
      },
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
        },
        {
          test: /\.css$/,
          type: 'asset/source', // Import CSS files as raw text strings
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
    devtool: (isDev || isReadable) ? 'source-map' : false,
    optimization: {
      minimize: true, // Always use minimizer for proper string escaping
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: (isDev || isReadable) ? false : {
              drop_console: false, // Keep console for userscript debugging
              drop_debugger: true,
              pure_funcs: ['console.debug'], // Remove debug logs in prod
            },
            mangle: (isDev || isReadable) ? false : true, // No mangling in dev/readable
            format: {
              comments: (isDev || isReadable) ? true : false, // Keep comments in dev/readable
              beautify: (isDev || isReadable) ? true : false, // Beautify in dev/readable
              indent_level: 2, // Readable indentation
            },
          },
          extractComments: false,
        }),
      ],
      moduleIds: 'deterministic', // Better long-term caching
      runtimeChunk: false, // Single bundle for userscript
      splitChunks: false, // Keep everything in one file for userscript
      usedExports: isDev ? false : true, // Enable tree shaking in production (even readable)
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
      compress: false, // Disable compression for easier debugging in dev
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