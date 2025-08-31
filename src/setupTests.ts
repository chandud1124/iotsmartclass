import '@testing-library/jest-dom';

// Mock environment variables
process.env.VITE_API_BASE_URL = 'http://localhost:3001/api';
process.env.VITE_WEBSOCKET_URL = 'http://localhost:3001';

// Mock fetch for API calls
Object.defineProperty(window, 'fetch', {
  writable: true,
  value: jest.fn(),
});

// Mock WebSocket
Object.defineProperty(window, 'WebSocket', {
  writable: true,
  value: jest.fn(),
});

// Mock ResizeObserver
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })),
});

// Mock IntersectionObserver
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })),
});
