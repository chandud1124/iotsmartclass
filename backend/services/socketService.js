const socketIo = require('socket.io');
const Device = require('../models/Device');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { wsLimiter } = require('../middleware/rateLimiter');
const { logger } = require('../middleware/logger');

class SocketService {
    constructor(io) {
        this.io = io;
        this.connectedClients = new Map();
        this.onlineUsers = new Map(); // Track userId -> socketIds
        this.setupSocketEvents();
    }

    setupSocketEvents() {
        this.io.on('connection', (socket) => {
            console.log('Client connected:', socket.id);

            socket.on('authenticate', async (token) => {
                try {
                    // Verify JWT token
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    const user = await User.findById(decoded.id);

                    if (user) {
                        // Store authenticated socket with user info
                        this.connectedClients.set(socket.id, {
                            socket,
                            authenticated: true,
                            userId: user._id
                        });

                        // Track online users
                        if (!this.onlineUsers.has(user._id.toString())) {
                            this.onlineUsers.set(user._id.toString(), new Set());
                        }
                        this.onlineUsers.get(user._id.toString()).add(socket.id);

                        // Update user's online status
                        await User.findByIdAndUpdate(user._id, {
                            isOnline: true,
                            lastSeen: new Date()
                        });

                        // Notify admins about user coming online
                        this.notifyAdminsUserStatus(user._id, true);

                        console.log(`User ${user.name} authenticated and online`);
                        socket.emit('authenticated', { success: true });
                    } else {
                        socket.emit('auth_error', { message: 'User not found' });
                    }
                } catch (error) {
                    console.error('Socket authentication error:', error.message);
                    socket.emit('auth_error', { message: 'Authentication failed' });
                }
            });

            socket.on('subscribe:device', (deviceId) => {
                socket.join(`device:${deviceId}`);
            });

            socket.on('unsubscribe:device', (deviceId) => {
                socket.leave(`device:${deviceId}`);
            });

            socket.on('disconnect', async () => {
                console.log('Client disconnected:', socket.id);

                const clientInfo = this.connectedClients.get(socket.id);
                this.connectedClients.delete(socket.id);

                if (clientInfo && clientInfo.userId) {
                    const userId = clientInfo.userId.toString();
                    const userSockets = this.onlineUsers.get(userId);

                    if (userSockets) {
                        userSockets.delete(socket.id);

                        // If user has no more active sockets, mark as offline
                        if (userSockets.size === 0) {
                            this.onlineUsers.delete(userId);

                            // Update user's online status
                            await User.findByIdAndUpdate(userId, {
                                isOnline: false,
                                lastSeen: new Date()
                            });

                            // Notify admins about user going offline
                            this.notifyAdminsUserStatus(userId, false);

                            console.log(`User ${userId} went offline`);
                        }
                    }
                }
            });
        });
    }

    broadcastDeviceUpdate(deviceId, update) {
        this.io.to(`device:${deviceId}`).emit('device:update', {
            deviceId,
            ...update
        });
    }

    notifyError(deviceId, error) {
        this.io.to(`device:${deviceId}`).emit('device:error', {
            deviceId,
            error
        });
    }

    broadcastStatusChange(deviceId, status) {
        this.io.to(`device:${deviceId}`).emit('device:status', {
            deviceId,
            status
        });
    }

    // Notify admins when user comes online/offline
    async notifyAdminsUserStatus(userId, isOnline) {
        try {
            const user = await User.findById(userId).select('name email role');
            if (!user) return;

            // Find all admin sockets
            const adminSockets = [];
            for (const [socketId, clientInfo] of this.connectedClients.entries()) {
                if (clientInfo.authenticated && clientInfo.userId) {
                    const adminUser = await User.findById(clientInfo.userId);
                    if (adminUser && adminUser.role === 'admin') {
                        adminSockets.push(socketId);
                    }
                }
            }

            // Notify all admin clients
            adminSockets.forEach(socketId => {
                this.io.to(socketId).emit('user_status_change', {
                    userId: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    isOnline,
                    lastSeen: new Date()
                });
            });
        } catch (error) {
            console.error('Error notifying admins:', error.message);
        }
    }

    // Get list of online users
    async getOnlineUsers() {
        try {
            const onlineUserIds = Array.from(this.onlineUsers.keys());
            if (onlineUserIds.length === 0) return [];

            const onlineUsers = await User.find({
                _id: { $in: onlineUserIds },
                isActive: true
            }).select('name email role department lastSeen');

            return onlineUsers.map(user => ({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
                lastSeen: user.lastSeen
            }));
        } catch (error) {
            console.error('Error getting online users:', error.message);
            return [];
        }
    }

    // Check if specific user is online
    isUserOnline(userId) {
        return this.onlineUsers.has(userId.toString());
    }
}

module.exports = SocketService;
