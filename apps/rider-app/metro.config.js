// Lets Metro read the workspace packages (@qc/contracts, @qc/api-client) straight from their
// TypeScript source through the custom "qc-source" export condition, so no build step is needed.
// Metro loads this file as CommonJS, so require() is correct here
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.unstable_conditionNames = Array.from(
  new Set(["qc-source", ...(config.resolver.unstable_conditionNames ?? [])]),
);

module.exports = config;
