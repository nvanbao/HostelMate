export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/coverage/'],
  collectCoverageFrom: ['*.js', 'src/**/*.js', '!jest.config.js', '!reset-db.js'],
  coverageThreshold: { global: { lines: 60 } },
};
