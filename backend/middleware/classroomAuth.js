const ClassroomAccess = require('../models/ClassroomAccess');
const User = require('../models/User');

const checkClassroomAccess = (requiredPermissions = ['canControlDevices']) => {
    return async (req, res, next) => {
        try {
            const { classroom } = req.body || req.params || req.query;

            if (!classroom) {
                return res.status(400).json({
                    message: 'Classroom parameter is required',
                    code: 'MISSING_CLASSROOM'
                });
            }

            const user = req.user;

            // Admin override
            if (user.role === 'admin') {
                return next();
            }

            // Check if user has general classroom access permissions
            if (user.classroomPermissions?.canAccessAllClassrooms) {
                return next();
            }

            // Check department-based access
            if (user.classroomPermissions?.departmentOverride && user.department) {
                const classroomPrefix = classroom.split('-')[0]; // e.g., "CS-" from "CS-101"
                if (classroomPrefix === user.department) {
                    return next();
                }
            }

            // Check assigned rooms
            if (user.assignedRooms && user.assignedRooms.includes(classroom)) {
                return next();
            }

            // Check specific classroom access permissions
            const classroomAccess = await ClassroomAccess.findOne({
                classroom,
                user: user._id,
                isActive: true,
                $or: [
                    { expiresAt: { $exists: false } },
                    { expiresAt: { $gt: new Date() } }
                ]
            });

            if (!classroomAccess) {
                return res.status(403).json({
                    message: 'Access denied to this classroom',
                    code: 'CLASSROOM_ACCESS_DENIED'
                });
            }

            // Check time restrictions if enabled
            if (classroomAccess.timeRestrictions?.enabled) {
                const now = new Date();
                const currentDay = now.toLocaleLowerCase('en-US', { weekday: 'long' });
                const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

                const allowedDays = classroomAccess.timeRestrictions.allowedDays || [];
                if (!allowedDays.includes(currentDay)) {
                    return res.status(403).json({
                        message: 'Access not allowed on this day',
                        code: 'TIME_RESTRICTION_DAY'
                    });
                }

                const startTime = classroomAccess.timeRestrictions.startTime;
                const endTime = classroomAccess.timeRestrictions.endTime;

                if (startTime && endTime && (currentTime < startTime || currentTime > endTime)) {
                    // Check if user has bypass permission
                    if (!user.classroomPermissions?.bypassTimeRestrictions) {
                        return res.status(403).json({
                            message: 'Access not allowed at this time',
                            code: 'TIME_RESTRICTION_TIME'
                        });
                    }
                }
            }

            // Check specific permissions required for this action
            for (const permission of requiredPermissions) {
                if (!classroomAccess.permissions[permission]) {
                    return res.status(403).json({
                        message: `Missing required permission: ${permission}`,
                        code: 'INSUFFICIENT_PERMISSIONS'
                    });
                }
            }

            // Attach classroom access info to request for logging
            req.classroomAccess = classroomAccess;
            next();

        } catch (error) {
            console.error('Classroom access check error:', error);
            res.status(500).json({
                message: 'Server error during classroom access check',
                code: 'ACCESS_CHECK_ERROR'
            });
        }
    };
};

const checkEmergencyAccess = async (req, res, next) => {
    try {
        const user = req.user;

        if (user.classroomPermissions?.emergencyAccess || user.role === 'admin' || user.role === 'security') {
            return next();
        }

        return res.status(403).json({
            message: 'Emergency access not authorized',
            code: 'EMERGENCY_ACCESS_DENIED'
        });
    } catch (error) {
        res.status(500).json({
            message: 'Server error during emergency access check',
            code: 'EMERGENCY_CHECK_ERROR'
        });
    }
};

module.exports = { checkClassroomAccess, checkEmergencyAccess };