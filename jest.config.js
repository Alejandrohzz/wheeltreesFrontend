module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  collectCoverageFrom: ['services/auth.ts', 'services/viajes.ts', 'context/AuthContext.tsx'],
  coverageDirectory: 'reports/coverage',
};