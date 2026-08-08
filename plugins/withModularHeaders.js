const { withPodfile } = require('@expo/config-plugins');

/**
 * Google Mobile Ads brings AppCheckCore into the iOS dependency graph. EAS
 * builds it as a static library, so its Google dependencies must expose module
 * maps for CocoaPods to integrate it successfully.
 */
module.exports = function withModularHeaders(config) {
  return withPodfile(config, (config) => {
    if (!config.modResults.contents.includes('use_modular_headers!')) {
      config.modResults.contents = config.modResults.contents.replace(
        /platform :ios,.*\n/,
        (line) => `${line}use_modular_headers!\n`
      );
    }

    return config;
  });
};
