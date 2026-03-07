import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: (): {
    route: string;
    pathname: string;
    query: Record<string, string>;
    asPath: string;
    push: jest.Mock;
    replace: jest.Mock;
    reload: jest.Mock;
    back: jest.Mock;
    prefetch: jest.Mock;
    beforePopState: jest.Mock;
    events: {
      on: jest.Mock;
      off: jest.Mock;
      emit: jest.Mock;
    };
    isFallback: boolean;
    isLocaleDomain: boolean;
    isReady: boolean;
    isPreview: boolean;
  } => ({
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
    push: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    beforePopState: jest.fn(),
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
    isFallback: false,
    isLocaleDomain: false,
    isReady: true,
    isPreview: false,
  }),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Suppress console errors during tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
