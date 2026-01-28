// Jest setup file
// This file runs before each test file

// Mock useColorScheme hook
jest.mock('./components/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));
