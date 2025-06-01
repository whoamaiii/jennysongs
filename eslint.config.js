const js = require('@eslint/js');
const jest = require('eslint-plugin-jest');

// Custom rule to prevent jest imports in production code
const noJestImports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent jest imports in production code'
    },
    messages: {
      jestImport: 'Jest imports are not allowed in production code'
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.name === 'require' && 
            node.arguments[0] && 
            node.arguments[0].type === 'Literal' &&
            node.arguments[0].value === 'jest') {
          context.report({
            node,
            messageId: 'jestImport'
          });
        }
      },
      ImportDeclaration(node) {
        if (node.source.value === 'jest') {
          context.report({
            node,
            messageId: 'jestImport'
          });
        }
      }
    };
  }
};

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'writable',
        module: 'writable',
        require: 'readonly',
        global: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['**/__tests__/**/*.js', '**/*.test.js'],
    plugins: {
      jest
    },
    languageOptions: {
      globals: {
        ...jest.environments.globals.globals,
        jest: 'readonly',
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly'
      }
    },
    rules: {
      ...jest.configs.recommended.rules
    }
  },
  {
    files: ['netlify/functions/**/*.js'],
    ignores: ['**/__tests__/**'],
    plugins: {
      custom: {
        rules: {
          'no-jest-imports': noJestImports
        }
      }
    },
    rules: {
      'custom/no-jest-imports': 'error'
    }
  }
];