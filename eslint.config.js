// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");
const globals = require("globals");

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: [
      "dist/**",
      "server_dist/**",
      "static-build/**",
      "attached_assets/**",
    ],
  },
  {
    // eslint-plugin-react-hooks 7 (SDK 58) turns React Compiler diagnostics
    // into errors. This app already enables the compiler via
    // experiments.reactCompiler and the compiler skips components it cannot
    // optimize. These rules flag existing effects, refs, and animated values
    // across the app; keep the classic hooks rules.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
    },
  },
  {
    // Jest tests register mocks before importing the module under test.
    // import/first --fix hoists those imports and breaks mock initialization.
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "import/first": "off",
    },
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: globals.node,
    },
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
            'MemberExpression[object.name="Easing"][property.name=/^(ease|quad|cubic|bounce|sin|circle|exp|step0|step1)$/]',
          message:
            "Do not use raw Easing curves inline. Import the appropriate easing constant from @/constants/animation instead.",
        },
        {
          selector:
            'CallExpression[callee.type="MemberExpression"][callee.object.name="Easing"][callee.property.name="elastic"]',
          message:
            "Do not use Easing.elastic() inline. Import the appropriate easing constant from @/constants/animation instead.",
        },
        {
          selector:
            'CallExpression[callee.type="MemberExpression"][callee.object.name="Easing"][callee.property.name="bezier"]',
          message:
            "Do not use Easing.bezier() inline. Import the appropriate easing constant from @/constants/animation instead.",
        },
        {
          selector:
            'CallExpression[callee.type="MemberExpression"][callee.object.name="Easing"][callee.property.name="back"]',
          message:
            "Do not use Easing.back() inline. Import the appropriate easing constant from @/constants/animation instead.",
        },
        {
          selector:
            'CallExpression[callee.type="MemberExpression"][callee.object.name="Easing"][callee.property.name="poly"]',
          message:
            "Do not use Easing.poly() inline. Import the appropriate easing constant from @/constants/animation instead.",
        },
      ],
    },
  },
]);
