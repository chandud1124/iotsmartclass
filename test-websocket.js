// WebSocket Connection Test
import io from 'socket.io-client';

// Test connection to backend
const socket = io('http://localhost:3001', {
    transports: ['polling', 'websocket'],
    upgrade: true,
    rememberUpgrade: true,
    timeout: 20000
});

socket.on('connect', () => {
    console.log('✅ WebSocket connected successfully!');
    console.log('Transport:', socket.io.engine.transport.name);
});

socket.on('connect_error', (error) => {
    console.error('❌ WebSocket connection failed:', error);
});

socket.on('disconnect', (reason) => {
    console.log('WebSocket disconnected:', reason);
});

// Handle transport upgrades
socket.io.engine.on('upgrade', () => {
    console.log('🚀 Successfully upgraded to WebSocket transport');
});

socket.io.engine.on('upgradeError', (error) => {
    console.warn('⚠️ WebSocket upgrade failed:', error);
});

// Test authentication
setTimeout(() => {
    console.log('🔐 Testing authentication...');
    socket.emit('authenticate', { test: true });
}, 2000);

// Clean exit after 10 seconds
setTimeout(() => {
    console.log('🛑 Closing test connection...');
    socket.disconnect();
    process.exit(0);
}, 10000);
