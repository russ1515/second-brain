const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);
// Admin currently consumes no workspace source package at runtime; avoiding a
// full-monorepo watch keeps its production export deterministic and bounded.
config.watchFolders = [];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules'), path.resolve(workspaceRoot, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;
module.exports = config;
