import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";

export default [
    {
        // Apply these rules to all TypeScript files in tptplus
        files: ["tptplus/client/**/*.ts", "tptplus/server/**/*.ts"],
        languageOptions: {
            parser: typescriptParser,
            globals: {
                node: true,
            },
        },
        plugins: {
            "@typescript-eslint": typescriptEslint,
        },
        rules: {
            ...typescriptEslint.configs.recommended.rules,
            "@typescript-eslint/no-unused-vars": "warn",
            "no-console": "warn",
        },
    },
    {
        // Global ignores (replaces .eslintignore)
        ignores: ["**/node_modules/", "**/out/", "**/dist/", "**/*.vsix"],
    },
];