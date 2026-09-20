import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // ponytail: Mongoose .lean() returns plain objects; typing every field
      // across 4 data-heavy API routes would be ~200 lines of interfaces
      // for zero runtime safety gain. Upgrade path: codegen types from schemas.
      "@typescript-eslint/no-explicit-any": "off",
      // React 19 lint rule flags legitimate patterns like syncing global
      // order state into component-local state via useEffect.
      "react-hooks/set-state-in-effect": "off",
      // React 19 experimental purity check flags Date.now() / new Date() inside client useMemo
      "react-hooks/purity": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
