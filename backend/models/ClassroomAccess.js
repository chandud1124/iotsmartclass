const mongoose = require('mongoose');

const classroomAccessSchema = new mongoose.Schema({
    classroom: {
        type: String,
        required: true,
        trim: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    permissions: {
        canControlDevices: { type: Boolean, default: true },
        canViewSensors: { type: Boolean, default: true },
        canModifySchedule: { type: Boolean, default: false },
        canAccessAfterHours: { type: Boolean, default: false },
        canOverrideSecurity: { type: Boolean, default: false }
    },
    timeRestrictions: {
        enabled: { type: Boolean, default: false },
        allowedDays: [{ type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] }],
        startTime: String, // HH:MM format
        endTime: String    // HH:MM format
    },
    grantedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    grantedAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: Date,
    isActive: {
        type: Boolean,
        default: true
    },
    reason: {
        type: String,
        trim: true,
        maxlength: 500
    }
}, {
    timestamps: true
});

// Compound index for efficient queries
classroomAccessSchema.index({ classroom: 1, user: 1 });
classroomAccessSchema.index({ user: 1, isActive: 1 });
classroomAccessSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ClassroomAccess', classroomAccessSchema);