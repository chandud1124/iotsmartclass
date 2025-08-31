const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

// Mock the database connection
jest.mock('mongoose', () => ({
  connect: jest.fn(),
  connection: {
    on: jest.fn(),
    readyState: 1
  }
}));

// Mock the logger
jest.mock('../middleware/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

const app = express();
app.use(express.json());

// Basic health check endpoint for testing
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Test suite
describe('Server Health Check', () => {
  beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
  });

  afterAll(async () => {
    // Cleanup
    await mongoose.connection.close();
  });

  test('should return server health status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'OK');
    expect(response.body).toHaveProperty('message', 'Server is running');
  });

  test('should handle invalid routes', async () => {
    await request(app)
      .get('/invalid-route')
      .expect(404);
  });
});
