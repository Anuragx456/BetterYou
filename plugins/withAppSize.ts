import { ConfigPlugin, withGradleProperties, withAppBuildGradle } from "@expo/config-plugins";

interface GradlePropertyEntry {
  type: string;
  key?: string;
  value?: string;
}

const withAppSize: ConfigPlugin = (config) => {
  config = withGradleProperties(config, (cfg) => {
    const props = cfg.modResults as GradlePropertyEntry[];
    const upsert = (key: string, value: string) => {
      const idx = props.findIndex((p) => p.type === "property" && p.key === key);
      if (idx >= 0) {
        props[idx].value = value;
      } else {
        props.push({ type: "property", key, value });
      }
    };
    upsert("reactNativeArchitectures", "arm64-v8a");
    upsert("android.enableMinifyInReleaseBuilds", "true");
    upsert("android.enableShrinkResourcesInReleaseBuilds", "true");
    upsert("android.enablePngCrunchInReleaseBuilds", "true");
    upsert("android.enableBundleCompression", "true");
    upsert("expo.useLegacyPackaging", "true");
    upsert("hermesEnabled", "true");
    upsert("expo.gif.enabled", "false");
    upsert("expo.webp.enabled", "false");
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    // Safely inject resConfigs into defaultConfig without brittle versionName assumptions
    if (!contents.includes('resConfigs "en", "hi"')) {
      contents = contents.replace(
        /defaultConfig\s*\{/,
        'defaultConfig {\n        resConfigs "en", "hi"'
      );
    }
    cfg.modResults.contents = contents;
    return cfg;
  });

  return config;
};

export default withAppSize;
