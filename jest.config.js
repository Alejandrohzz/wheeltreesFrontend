module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  collectCoverageFrom: [
    'services/auth.ts', 'services/viajes.ts', 'services/api.ts', 'services/biometrics.ts',
    'context/AuthContext.tsx', 'app/login.tsx',
  ],
  coverageDirectory: 'reports/coverage',
};