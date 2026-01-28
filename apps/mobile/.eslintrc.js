// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  plugins: ['react', 'react-hooks'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  overrides: [
    {
      files: ['*.js', '*.jsx'],
      parser: 'espree',
    },
  ],
  env: {
    es6: true,
    node: true,
    jest: true,
  },
  ignorePatterns: ['/dist/*', '/node_modules/*', '/.expo/*', '*.config.js'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-unused-vars': 'off', // Turn off base rule as it conflicts with TypeScript
    'no-undef': 'off', // TypeScript handles this
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'react/no-unescaped-entities': 'warn',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
