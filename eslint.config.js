// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: ["dist/*"],
  },
  {
    files: ["client/**/*.{js,ts,jsx,tsx}"],
    ignores: ["client/constants/animation.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'CallExpression[callee.type="MemberExpression"][callee.object.name="Easing"][callee.property.name="in"]',
          message:
            "Do not use Easing.in() inline. Import the appropriate easing constant from @/constants/animation instead.",
        },
        {
          selector:
            'CallExpression[callee.type="MemberExpression"][callee.object.name="Easing"][callee.property.name="out"]',
          message:
            "Do not use Easing.out() inline. Import the appropriate easing constant from @/constants/animation instead.",
        },
        {
          selector:
            'CallExpression[callee.type="MemberExpression"][callee.object.name="Easing"][callee.property.name="inOut"]',
          message:
            "Do not use Easing.inOut() inline. Import the appropriate easing constant from @/constants/animation instead.",
        },
        {
          selector:
            'MemberExpression[object.name="Easing"][property.name="linear"]',
          message:
            "Do not use Easing.linear directly. Import ANIM_EASING_LINEAR from @/constants/animation instead.",
        },
        {
          selector:
            'CallExpression[callee.name="withTiming"] Property[key.name="duration"][value.type="Literal"]',
          message:
            "Do not hardcode duration values in withTiming(). Import the appropriate duration constant from @/constants/animation instead.",
        },
        {
          selector:
            'CallExpression[callee.name="withSpring"] Property[key.name="duration"][value.type="Literal"]',
          message:
            "Do not hardcode duration values in withSpring(). Import the appropriate duration constant from @/constants/animation instead.",
        },
        {
          selector:
            'CallExpression[callee.name="withDelay"][arguments.0.type="Literal"]',
          message:
            "Do not hardcode delay values in withDelay(). Import the appropriate delay constant from @/constants/animation instead.",
        },
        {
          selector:
            'Property[key.name="easing"] > MemberExpression[object.name="Easing"][property.name=/^(ease|quad|cubic|bezier|back|bounce|sin|circle|exp|elastic)$/]',
          message:
            "Do not use raw Easing curves inline. Import the appropriate easing constant from @/constants/animation instead.",
        },
      ],
    },
  },
]);
