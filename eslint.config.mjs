import js from "@eslint/js";
import tseslint from "typescript-eslint";

const globals = {
  console: "readonly",
  document: "readonly",
  process: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  window: "readonly"
};

const browserGlobals = {
  ...globals,
  navigator: "readonly",
  location: "readonly",
  history: "readonly",
  performance: "readonly",
  crypto: "readonly",
  TextEncoder: "readonly",
  TextDecoder: "readonly",
  Uint8Array: "readonly",
  Uint16Array: "readonly",
  Uint32Array: "readonly",
  Int8Array: "readonly",
  Int16Array: "readonly",
  Int32Array: "readonly",
  Float32Array: "readonly",
  Float64Array: "readonly",
  ArrayBuffer: "readonly",
  SharedArrayBuffer: "readonly",
  Atomics: "readonly",
  DataView: "readonly",
  Blob: "readonly",
  File: "readonly",
  FileReader: "readonly",
  DecompressionStream: "readonly",
  CompressionStream: "readonly",
  ReadableStream: "readonly",
  Response: "readonly",
  Request: "readonly",
  Headers: "readonly",
  MessageChannel: "readonly",
  Worker: "readonly",
  WebAssembly: "readonly",
  btoa: "readonly",
  atob: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  requestAnimationFrame: "readonly",
  cancelAnimationFrame: "readonly",
  alert: "readonly",
  confirm: "readonly",
  prompt: "readonly",
  CustomEvent: "readonly",
  Event: "readonly",
  HTMLElement: "readonly",
  Node: "readonly",
  Element: "readonly",
  MutationObserver: "readonly",
  ResizeObserver: "readonly",
  IntersectionObserver: "readonly",
  localStorage: "readonly",
  sessionStorage: "readonly",
  indexedDB: "readonly",
  fetch: "readonly",
  self: "readonly",
  globalThis: "readonly",
  module: "readonly",
  exports: "readonly",
  define: "readonly"
};

const serviceWorkerGlobals = {
  self: "readonly",
  caches: "readonly",
  clients: "readonly",
  fetch: "readonly",
  Response: "readonly",
  Request: "readonly",
  Headers: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  Promise: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly"
};

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/output/**",
      "site/**"
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
    files: ["docs/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: browserGlobals
    },
    rules: {
      "no-undef": "error",
      "no-empty": ["error", { allowEmptyCatch: false }],
      "no-control-regex": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "no-var": "off",
      "prefer-const": "off"
    }
  },
  {
    files: ["docs/coi-airgap-enclave-sw.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: serviceWorkerGlobals
    },
    rules: {
      "no-undef": "error",
      "no-empty": ["error", { allowEmptyCatch: false }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "no-var": "off",
      "prefer-const": "off"
    }
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-implied-eval": "off"
    }
  }
);
