module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/client", "<rootDir>/server"],
  testMatch: [
    "<rootDir>/client/lib/__tests__/**/*.test.ts",
    "<rootDir>/server/__tests__/**/*.test.ts",
  ],
  modulePathIgnorePatterns: ["<rootDir>/.cache/", "<rootDir>/node_modules/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/client/$1",
    "^@shared/(.*)$": "<rootDir>/shared/$1",
  },
  haste: {
    enableSymlinks: false,
    forceNodeFilesystemAPI: true,
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          target: "es2020",
          esModuleInterop: true,
          jsx: "react",
          isolatedModules: true,
          skipLibCheck: true,
        },
        diagnostics: false,
      },
    ],
  },
};
