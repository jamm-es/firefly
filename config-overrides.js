const { override, adjustStyleLoaders } = require('customize-cra-5');

module.exports = override(
  (config) => {
    config.optimization.splitChunks = {
      cacheGroups: { default: false }
    };
    config.optimization.runtimeChunk = false;
    config.output.filename = 'static/js/bundle.js'

    return config;
  },
  adjustStyleLoaders(({ use }) => {
    use.forEach((loader) => {
      if (/mini-css-extract-plugin/.test(loader.loader)) {
        loader.loader = require.resolve('style-loader');
        loader.options = {};
      }
    });
  })
);