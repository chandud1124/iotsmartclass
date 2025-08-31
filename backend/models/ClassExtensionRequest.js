const mongoose = require('mongoose');

const classExtensionRequestSchema = new mongoose.Schema({
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    scheduleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Schedule',
        required: true,
        index: true
    },
    originalEndTime: {
        type: Date,
        required: true
    },
    requestedEndTime: {
        type: Date,
        required: true
    },
    extensionDuration: {
        type: Number, // in minutes
        required: true,
        min: 1,
        max: 120 // Maximum 2 hours extension
    },
    reason: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'auto_approved'],
        default: 'pending',
        index: true
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
    autoApproved: {
        type: Boolean,
        default: false
    },
    approvalLevel: {
        type: String,
        enum: ['faculty', 'hod', 'dean', 'principal', 'admin'],
        default: 'hod' // Default approval level
    },
    roomNumber: {
        type: String,
        required: true,
        trim: true
    },
    subject: {
        type: String,
        trim: true
    },
    classDetails: {
        semester: String,
        section: String,
        batch: String,
        studentCount: Number
    },
    conflicts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Schedule'
    }],
    notificationsSent: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        notificationType: {
            type: String,
            enum: ['request_submitted', 'approved', 'rejected', 'conflict_detected']
        },
        sentAt: {
            type: Date,
            default: Date.now
        }
    }],
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
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        index: { expires: 0 } // TTL index
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
classExtensionRequestSchema.index({ status: 1, createdAt: -1 });
classExtensionRequestSchema.index({ requestedBy: 1, status: 1 });
classExtensionRequestSchema.index({ scheduleId: 1, status: 1 });
classExtensionRequestSchema.index({ roomNumber: 1, requestedEndTime: 1 });

// Pre-save middleware to calculate extension duration and set approval level
classExtensionRequestSchema.pre('save', function (next) {
    if (this.isNew) {
        // Calculate extension duration in minutes
        this.extensionDuration = Math.round((this.requestedEndTime - this.originalEndTime) / (1000 * 60));

        // Set approval level based on extension duration
        if (this.extensionDuration <= 15) {
            this.approvalLevel = 'faculty'; // Short extensions can be auto-approved or faculty approved
        } else if (this.extensionDuration <= 30) {
            this.approvalLevel = 'hod';
        } else if (this.extensionDuration <= 60) {
            this.approvalLevel = 'dean';
        } else {
            this.approvalLevel = 'principal'; // Long extensions need higher approval
        }

        // Set priority based on duration
        if (this.extensionDuration >= 60) {
            this.priority = 'high';
        } else if (this.extensionDuration >= 30) {
            this.priority = 'medium';
        } else {
            this.priority = 'low';
        }
    }
    next();
});

// Instance method to check if extension can be approved by a user
classExtensionRequestSchema.methods.canBeApprovedBy = function (approverRole) {
    const approvalHierarchy = {
        'faculty': ['faculty', 'hod', 'dean', 'principal', 'admin'],
        'hod': ['hod', 'dean', 'principal', 'admin'],
        'dean': ['dean', 'principal', 'admin'],
        'principal': ['principal', 'admin'],
        'admin': ['admin']
    };

    return approvalHierarchy[this.approvalLevel]?.includes(approverRole) || false;
};

// Instance method to check for scheduling conflicts
classExtensionRequestSchema.methods.checkConflicts = async function () {
    const Schedule = mongoose.model('Schedule');

    const conflictingSchedules = await Schedule.find({
        roomNumber: this.roomNumber,
        $or: [
            {
                startTime: { $lt: this.requestedEndTime },
                endTime: { $gt: this.originalEndTime }
            }
        ],
        _id: { $ne: this.scheduleId } // Exclude the current schedule
    });

    this.conflicts = conflictingSchedules.map(schedule => schedule._id);
    return conflictingSchedules;
};

// Static method to get pending requests for approval
classExtensionRequestSchema.statics.getPendingRequestsForApproval = function (userRole, userDepartment = null) {
    const query = { status: 'pending' };

    // Filter based on user's approval permissions and department
    if (userRole === 'faculty') {
        query.approvalLevel = 'faculty';
        if (userDepartment) {
            // Faculty can only approve extensions in their department
            query['classDetails.department'] = userDepartment;
        }
    } else if (userRole === 'hod') {
        query.approvalLevel = { $in: ['faculty', 'hod'] };
        if (userDepartment) {
            query['classDetails.department'] = userDepartment;
        }
    } else if (userRole === 'dean') {
        query.approvalLevel = { $in: ['faculty', 'hod', 'dean'] };
    } else if (userRole === 'principal') {
        query.approvalLevel = { $in: ['faculty', 'hod', 'dean', 'principal'] };
    } else if (userRole === 'admin') {
        // Admins can see all
    }

    return this.find(query)
        .populate('requestedBy', 'name email department')
        .populate('scheduleId', 'subject startTime endTime')
        .sort({ priority: -1, createdAt: -1 });
};

// Static method to auto-approve short extensions
classExtensionRequestSchema.statics.autoApproveShortExtensions = async function () {
    const shortExtensions = await this.find({
        status: 'pending',
        extensionDuration: { $lte: 15 },
        approvalLevel: 'faculty'
    });

    for (const extension of shortExtensions) {
        // Check for conflicts before auto-approving
        const conflicts = await extension.checkConflicts();
        if (conflicts.length === 0) {
            extension.status = 'auto_approved';
            extension.autoApproved = true;
            extension.approvedAt = new Date();
            await extension.save();

            // Update the original schedule
            const Schedule = mongoose.model('Schedule');
            await Schedule.findByIdAndUpdate(extension.scheduleId, {
                endTime: extension.requestedEndTime
            });
        }
    }
};

module.exports = mongoose.model('ClassExtensionRequest', classExtensionRequestSchema);
