const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

defaultConfig.resolver.unstable_enablePackageExports = true;

// defaultConfig.resolver.alias = {
//   ...defaultConfig.resolver.alias,
//   '#alloc': require.resolve('uint8arrays/dist/src/alloc.js'),
// };

module.exports = defaultConfig;



// module.exports = {
//   resolver: {
//     unstable_enablePackageExports: true,
//   },
// };
  