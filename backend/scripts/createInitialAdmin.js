const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const createInitialAdmin = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iot-classroom', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('Connected to MongoDB');

        // Check if admin already exists
        const existingAdmin = await User.findOne({ role: 'admin' });
        if (existingAdmin) {
            console.log('Admin user already exists:', existingAdmin.email);
            process.exit(0);
        }

        // Create initial admin user
        const adminUser = new User({
            name: 'System Administrator',
            email: 'admin@iotclassroom.com',
            password: 'admin123456', // This will be hashed by the pre-save middleware
            role: 'admin',
            department: 'IT',
            employeeId: 'ADMIN001',
            phone: '+1234567890',
            designation: 'System Administrator',
            isActive: true,
            isApproved: true,
            accessLevel: 'full',
            canRequestExtensions: true,
            canApproveExtensions: true,
            notificationPreferences: {
                email: true,
                inApp: true,
                securityAlerts: true
            }
        });

        await adminUser.save();

        console.log('Initial admin user created successfully!');
        console.log('Email: admin@iotclassroom.com');
        console.log('Password: admin123456');
        console.log('Please change the password after first login.');

    } catch (error) {
        console.error('Error creating initial admin:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

// Run the script
createInitialAdmin();
