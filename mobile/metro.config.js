const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const metamaskCjsModules = {
  '@metamask/mobile-wallet-protocol-core': path.join(
    __dirname,
    'node_modules/@metamask/mobile-wallet-protocol-core/dist/index.js',
  ),
  '@metamask/mobile-wallet-protocol-dapp-client': path.join(
    __dirname,
    'node_modules/@metamask/mobile-wallet-protocol-dapp-client/dist/index.js',
  ),
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const cjsModule = metamaskCjsModules[moduleName];

  if (cjsModule) {
    return {
      type: 'sourceFile',
      filePath: cjsModule,
    };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.unstable_conditionNames = [
  'react-native',
  'require',
  'default',
];

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: false,
  },
});

module.exports = config;
