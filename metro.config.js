// const { getDefaultConfig } = require("expo/metro-config");

// module.exports = (async () => {
//   const config = await getDefaultConfig(__dirname);
//   config.resolver.extraNodeModules = {
//     crypto: require.resolve("react-native-quick-crypto"),
//   };
//   return config;
// })();

const { getDefaultConfig } = require("expo/metro-config");

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);
  config.resolver.extraNodeModules = {
    crypto: require.resolve("react-native-quick-crypto"),
  };

  const { transformer, resolver } = config;

  config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve("react-native-svg-transformer/expo")
  };
  config.resolver = {
    ...resolver,
    assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
    sourceExts: [...resolver.sourceExts, "svg"]
  };

  return config;
})();