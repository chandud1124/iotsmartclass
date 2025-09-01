const ClassroomAccess = require('../models/ClassroomAccess');
const User = require('../models/User');
const Device = require('../models/Device');
const { logger } = require('../middleware/logger');

// Get all classroom access permissions for a user
const getUserClassroomAccess = async (req, res) => {
    try {
        const { userId } = req.params;

        // Only admins or the user themselves can view their access
        if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const accessRecords = await ClassroomAccess.find({
            user: userId,
            isActive: true
        }).populate('grantedBy', 'name email role');

        res.json({
            success: true,
            data: accessRecords
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Grant classroom access to a user
const grantClassroomAccess = async (req, res) => {
    try {
        const {
            userId,
            classroom,
            permissions,
            timeRestrictions,
            expiresAt,
            reason
        } = req.body;

        // Validate required fields
        if (!userId || !classroom) {
            return res.status(400).json({
                message: 'User ID and classroom are required'
            });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if classroom exists (has devices)
        const classroomDevices = await Device.find({ classroom });
        if (classroomDevices.length === 0) {
            return res.status(400).json({
                message: 'Invalid classroom - no devices found'
            });
        }

        // Check if access already exists
        const existingAccess = await ClassroomAccess.findOne({
            user: userId,
            classroom,
            isActive: true
        });

        if (existingAccess) {
            return res.status(400).json({
                message: 'User already has access to this classroom'
            });
        }

        // Create new access record
        const classroomAccess = new ClassroomAccess({
            classroom,
            user: userId,
            permissions: permissions || {
                canControlDevices: true,
                canViewSensors: true,
                canModifySchedule: false,
                canAccessAfterHours: false,
                canOverrideSecurity: false
            },
            timeRestrictions: timeRestrictions || { enabled: false },
            expiresAt: expiresAt ? new Date(expiresAt) : undefined,
            grantedBy: req.user._id,
            reason
        });

        await classroomAccess.save();

        // Log the action
        logger.info(`Classroom access granted: ${req.user.name} granted ${user.name} access to ${classroom}`, {
            action: 'GRANT_CLASSROOM_ACCESS',
            grantedBy: req.user._id,
            userId,
            classroom,
            permissions: classroomAccess.permissions
        });

        res.status(201).json({
            success: true,
            data: classroomAccess
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Revoke classroom access
const revokeClassroomAccess = async (req, res) => {
    try {
        const { accessId } = req.params;

        const accessRecord = await ClassroomAccess.findById(accessId);

        if (!accessRecord) {
            return res.status(404).json({ message: 'Access record not found' });
        }

        // Only admin or the person who granted access can revoke
        if (req.user.role !== 'admin' &&
            accessRecord.grantedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to revoke this access' });
        }

        accessRecord.isActive = false;
        await accessRecord.save();

        // Log the action
        logger.info(`Classroom access revoked: ${req.user.name} revoked access for ${accessRecord.classroom}`, {
            action: 'REVOKE_CLASSROOM_ACCESS',
            revokedBy: req.user._id,
            userId: accessRecord.user,
            classroom: accessRecord.classroom
        });

        res.json({
            success: true,
            message: 'Access revoked successfully'
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get all classrooms with access summary
const getClassroomsSummary = async (req, res) => {
    try {
        const classrooms = await Device.distinct('classroom');

        const summary = await Promise.all(
            classrooms.map(async (classroom) => {
                const deviceCount = await Device.countDocuments({ classroom });
                const activeAccessCount = await ClassroomAccess.countDocuments({
                    classroom,
                    isActive: true,
                    $or: [
                        { expiresAt: { $exists: false } },
                        { expiresAt: { $gt: new Date() } }
                    ]
                });

                return {
                    classroom,
                    deviceCount,
                    activeAccessCount
                };
            })
        );

        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get all active classroom access records
const getAllClassroomAccess = async (req, res) => {
    try {
        const accessRecords = await ClassroomAccess.find({
            isActive: true
        })
            .populate('user', 'name email role')
            .populate('grantedBy', 'name email role')
            .sort({ grantedAt: -1 });

        res.json({
            success: true,
            data: accessRecords
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    getUserClassroomAccess,
    grantClassroomAccess,
    revokeClassroomAccess,
    getClassroomsSummary,
    getAllClassroomAccess
};