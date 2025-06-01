module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFilesAfterEnv: ['jest-date-mock'],
  collectCoverageFrom: [
    'netlify/functions/**/*.js',
    '!netlify/functions/**/__tests__/**',
    '!netlify/functions/**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true
};
