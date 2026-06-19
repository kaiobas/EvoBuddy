const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const path = require("path");
const workspaceRoot = path.resolve(__dirname, "../..");
const nodeModulesPath = path.resolve(workspaceRoot, "node_modules");

const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [nodeModulesPath],
    disableHierarchicalLookup: true,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
