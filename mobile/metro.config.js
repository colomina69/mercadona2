const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Node built-ins referenced by @insforge/sdk's Node-only code paths.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  crypto: path.resolve(__dirname, 'src/shims/crypto.js'),
}

// Bundle the PDF.js build files as assets (custom extension).
config.resolver.assetExts.push('pdfjs')

module.exports = config
