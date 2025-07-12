module.exports = {
	root: true,
	env: {
		node: true,
		commonjs: true,
		es6: true,
		jquery: false,
		jest: true,
		jasmine: true,
	},
	extends: "eslint:recommended",
	parserOptions: {
		sourceType: "module",
		ecmaVersion: "2022",
	},
	rules: {
		quotes: ["warn", "double"],
		semi: ["error", "always"],
		"no-var": ["warn"],
		"no-console": ["off"],
		"no-unused-vars": ["warn"],
		"no-mixed-spaces-and-tabs": ["off"],
	},
};
