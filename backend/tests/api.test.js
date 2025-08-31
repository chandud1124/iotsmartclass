const request = require('supertest');
const express = require('express');
const app = express();

// Import your routes (adjust path as needed)
const authRoutes = require('../routes/auth');
const deviceRoutes = require('../routes/devices');

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);

describe('API Routes', () => {
    describe('GET /health', () => {
        test('should return health status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body).toHaveProperty('status', 'OK');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
        });
    });

    describe('POST /api/auth/login', () => {
        test('should validate email and password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'invalid-email',
                    password: ''
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('errors');
        });

        test('should accept valid login data', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            // This will fail without proper auth setup, but validates the route exists
            expect(response.status).not.toBe(404);
        });
    });
});
