module.exports = {
  env: {
    es6: true,
    node: true,
    mocha: true,
  },
  extends: "eslint:recommended",
  parserOptions: {
    sourceType: "module",
  },
  rules: {
    indent: ["error", 2],
    "linebreak-style": ["error", "unix"],
    quotes: ["warn", "double", { avoidEscape: true }],
    semi: ["error", "always"],
  },
};
