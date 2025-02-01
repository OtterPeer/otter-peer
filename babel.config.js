const path = require('path');

module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    ['module-resolver', {
      alias: {
        crypto: path.resolve(__dirname, 'node_modules/react-native-quick-crypto'),
      },
    }],
    ['@babel/plugin-transform-private-methods', { loose: true }],
  ],
};

  