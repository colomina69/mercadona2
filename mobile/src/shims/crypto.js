// React Native shim for Node's `crypto` module.
// @insforge/sdk only reaches for node:crypto when `process.versions.node`
// is defined, which never happens under Hermes. Metro still resolves the
// dynamic import statically, so we point it at this empty module.
module.exports = {}
