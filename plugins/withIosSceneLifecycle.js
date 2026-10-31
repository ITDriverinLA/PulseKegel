const { withInfoPlist } = require("expo/config-plugins");

/**
 * Xcode 27 / iOS 27 will not launch an app that still uses the application
 * lifecycle. Expo SDK 58's prebuild template generates SceneDelegate.swift
 * (subclass of ExpoAppSceneDelegate) and a UIApplicationSceneManifest.
 * This plugin keeps that manifest if a template or another plugin omitted it.
 *
 * UIApplicationSupportsMultipleScenes stays false: one window that resizes
 * (Duo fold, iPad Split View). Split View itself stays allowed via
 * supportsTablet and the absence of requireFullScreen.
 */
const SCENE_MANIFEST = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      {
        UISceneConfigurationName: "Default Configuration",
        UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
      },
    ],
  },
};

function hasSceneDelegate(manifest) {
  const scenes =
    manifest &&
    manifest.UISceneConfigurations &&
    manifest.UISceneConfigurations.UIWindowSceneSessionRoleApplication;
  if (!Array.isArray(scenes) || scenes.length === 0) return false;
  return scenes.some(
    (scene) =>
      scene &&
      typeof scene.UISceneDelegateClassName === "string" &&
      scene.UISceneDelegateClassName.length > 0,
  );
}

function withIosSceneLifecycle(config) {
  return withInfoPlist(config, (config) => {
    if (!hasSceneDelegate(config.modResults.UIApplicationSceneManifest)) {
      config.modResults.UIApplicationSceneManifest = SCENE_MANIFEST;
    }
    return config;
  });
}

module.exports = withIosSceneLifecycle;
