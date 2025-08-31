const mongoose = require('mongoose');

const permissionRequestSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    requestType: {
        type: String,
        enum: ['registration', 'role_change', 'access_upgrade', 'device_assignment'],
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: {
        type: Date
    },
    rejectedAt: {
        type: Date
    },
    rejectionReason: {
        type: String,
        trim: true
    },
    requestDetails: {
        // For registration requests
        name: String,
        email: String,
        role: String,
        department: String,
        employeeId: String,
        phone: String,
        designation: String,

        // For role change requests
        currentRole: String,
        requestedRole: String,
        reason: String,

        // For access upgrade requests
        currentAccessLevel: String,
        requestedAccessLevel: String,
        justification: String,

        // For device assignment requests
        deviceIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Device'
        }],
        roomNumbers: [String],
        assignmentReason: String
    },
    comments: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        comment: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        index: { expires: 0 } // TTL index
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
permissionRequestSchema.index({ status: 1, requestType: 1 });
permissionRequestSchema.index({ userId: 1, status: 1 });
permissionRequestSchema.index({ requestedBy: 1, createdAt: -1 });

// Pre-save middleware to set approval permissions based on request type
permissionRequestSchema.pre('save', function (next) {
    if (this.isNew) {
        // Set priority based on request type
        switch (this.requestType) {
            case 'registration':
                this.priority = 'high';
                break;
            case 'role_change':
                this.priority = 'medium';
                break;
            case 'access_upgrade':
                this.priority = 'low';
                break;
            case 'device_assignment':
                this.priority = 'medium';
                break;
        }
    }
    next();
});

// Instance method to check if request can be approved by a user
permissionRequestSchema.methods.canBeApprovedBy = function (approverRole) {
    const approvalHierarchy = {
        'registration': ['admin', 'principal'],
        'role_change': ['admin', 'principal', 'dean'],
        'access_upgrade': ['admin', 'principal', 'dean', 'hod'],
        'device_assignment': ['admin', 'principal', 'dean', 'hod', 'faculty']
    };

    return approvalHierarchy[this.requestType]?.includes(approverRole) || false;
};

// Static method to get pending requests for a user
permissionRequestSchema.statics.getPendingRequestsForUser = function (userId, userRole) {
    const query = { status: 'pending' };

    // Filter based on user's approval permissions
    if (userRole === 'admin') {
        // Admins can see all pending requests
    } else if (userRole === 'principal') {
        query.requestType = { $in: ['registration', 'role_change', 'access_upgrade', 'device_assignment'] };
    } else if (userRole === 'dean') {
        query.requestType = { $in: ['role_change', 'access_upgrade', 'device_assignment'] };
    } else if (userRole === 'hod') {
        query.requestType = { $in: ['access_upgrade', 'device_assignment'] };
    } else if (userRole === 'faculty') {
        query.requestType = { $in: ['device_assignment'] };
    } else {
        return []; // Other roles can't approve requests
    }

    return this.find(query).populate('userId', 'name email role department').sort({ createdAt: -1 });
};

module.exports = mongoose.model('PermissionRequest', permissionRequestSchema);
