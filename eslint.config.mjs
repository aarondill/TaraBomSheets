import { FlatCompat } from "@eslint/eslintrc";
import eslint from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	...new FlatCompat({ baseDirectory: import.meta.dirname }).extends(),
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
			parser: tsParser,
			parserOptions: {
				project: "./tsconfig.eslint.json",
				impliedStrict: true,
			},
		},

		rules: {
			"@typescript-eslint/no-misused-promises": [
				"error",
				{ checksVoidReturn: false },
			],

			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
		},
	},
	{
		// turn off rules that don't apply to JS code
		files: ["**/*.js"],
		extends: [tseslint.configs.disableTypeChecked],
		rules: {
			"other-plugin/typed-rule": "off",
			"@typescript-eslint/explicit-function-return-type": "off",
		},
	},
	// Turn off rules that prettier covers
	prettier
);
