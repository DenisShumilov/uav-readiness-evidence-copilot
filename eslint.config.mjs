import js from "@eslint/js";
import tseslint from "typescript-eslint";

const globals = {
  console: "readonly",
  document: "readonly",
  process: "readonly",
  setTimeout: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  window: "readonly"
};

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".claude/**",
      "examples/**/output/**",
      "coverage/**",
      "dist/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals
    }
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-implied-eval": "off"
    }
  }
);
