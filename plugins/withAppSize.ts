import { ConfigPlugin, withGradleProperties, withAppBuildGradle } from "@expo/config-plugins";

const withAppSize: ConfigPlugin = (config) => {
  config = withGradleProperties(config, (config) => {
    const props = config.modResults as any[];
    const upsert = (key: string, value: string) => {
      const idx = props.findIndex((p: any) => p.type === "property" && p.key === key);
      if (idx >= 0) props[idx].value = value;
      else props.push({ type: "property", key, value } as any);
    };
    // Include 32-bit ARM for broad Indian budget device compatibility alongside 64-bit
    upsert("reactNativeArchitectures", "arm64-v8a,armeabi-v7a");
    upsert("android.enableMinifyInReleaseBuilds", "true");
    upsert("android.enableShrinkResourcesInReleaseBuilds", "true");
    upsert("android.enablePngCrunchInReleaseBuilds", "true");
    upsert("android.enableBundleCompression", "true");
    upsert("hermesEnabled", "true");
    upsert("expo.gif.enabled", "false");
    upsert("expo.webp.enabled", "false");
    return config;
  });

  config = withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    // Safely inject resConfigs into defaultConfig without brittle versionName assumptions
    if (!contents.includes('resConfigs "en", "hi"')) {
      contents = contents.replace(
        /defaultConfig\s*\{/,
        'defaultConfig {\n        resConfigs "en", "hi"'
      );
    }
    config.modResults.contents = contents;
    return config;
  });

  return config;
};

export default withAppSize;
