
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const PermissionRequest = require('../models/PermissionRequest');
const ClassExtensionRequest = require('../models/ClassExtensionRequest');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const { sendPasswordResetEmail } = require('../services/emailService');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

const register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      department,
      employeeId,
      phone,
      designation,
      reason
    } = req.body;

    // Handle file uploads if present
    const profilePicture = req.files?.profilePicture ? req.files.profilePicture[0] : null;
    const idDocument = req.files?.idDocument ? req.files.idDocument[0] : null;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Check if there's already a pending permission request
    const existingRequest = await PermissionRequest.findOne({
      'requestDetails.email': email,
      status: 'pending'
    });
    if (existingRequest) {
      return res.status(400).json({ message: 'Registration request already pending approval' });
    }

    // Validate required fields
    if (!name || !email || !password || !role || !department) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate role-specific requirements
    if (role !== 'student' && !employeeId) {
      return res.status(400).json({ message: 'Employee ID is required for non-student roles' });
    }

    // Create user with inactive status
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'student',
      department,
      employeeId,
      phone,
      designation,
      registrationReason: reason,
      isActive: false,
      isApproved: false
    });

    // Create permission request for admin approval
    const permissionRequest = await PermissionRequest.create({
      userId: user._id,
      requestType: 'registration',
      requestedBy: user._id,
      requestDetails: {
        name,
        email,
        role: role || 'student',
        department,
        employeeId,
        phone,
        designation,
        reason,
        hasProfilePicture: !!profilePicture,
        hasIdDocument: !!idDocument
      }
    });

    // Handle file uploads if present
    if (profilePicture) {
      // Save profile picture path
      const profilePicturePath = `/uploads/profiles/${user._id}_${Date.now()}_${profilePicture.originalname}`;
      user.profilePicture = profilePicturePath;
    }

    if (idDocument) {
      // Save ID document path
      const idDocumentPath = `/uploads/documents/${user._id}_${Date.now()}_${idDocument.originalname}`;
      user.idDocument = idDocumentPath;
    }

    await user.save();

    // Create notification for admins
    const admins = await User.find({ role: 'admin', isActive: true });
    for (const admin of admins) {
      await Notification.createPermissionNotification({
        recipient: admin._id,
        requestId: permissionRequest._id,
        requestType: 'submitted',
        userName: name,
        requestDetails: {
          role: role || 'student',
          department,
          hasDocuments: !!(profilePicture || idDocument)
        }
      });
    }

    // Log the registration attempt
    await ActivityLog.create({
      userId: user._id,
      action: 'USER_REGISTRATION_REQUEST',
      details: `New user registration request submitted for ${email} with ${profilePicture ? 'profile picture' : 'no profile picture'} and ${idDocument ? 'ID document' : 'no ID document'}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      message: 'Registration request submitted successfully. Please wait for admin approval.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      },
      requestId: permissionRequest._id
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    // Fail fast if DB is not connected to avoid long buffering timeouts
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database unavailable', error: 'DB_NOT_CONNECTED' });
    }
    // Normalize email
    const emailRaw = req.body.email || '';
    const email = emailRaw.trim().toLowerCase();
    const { password } = req.body;

    // Extra debug (only in non-production)
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[auth:login] attempt', { email });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[auth:login] invalid credentials', { email, found: !!user });
      }
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated or pending approval' });
    }

    if (!user.isApproved) {
      return res.status(401).json({ message: 'Account is pending admin approval' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        accessLevel: user.accessLevel,
        assignedDevices: user.assignedDevices
      }
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[auth:login] error', error);
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('assignedDevices');
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Simple short-lived cache (per user) to avoid hammering DB if frontend mounts multiple times quickly
    if (!global.__profileCache) global.__profileCache = new Map();
    const key = user.id;
    const now = Date.now();
    const cached = global.__profileCache.get(key);
    if (cached && (now - cached.ts) < 5000) { // 5s TTL
      return res.json({ success: true, user: cached.data });
    }
    const safeUser = {
      _id: user._id,
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      phone: user.phone,
      designation: user.designation,
      accessLevel: user.accessLevel,
      assignedDevices: user.assignedDevices,
      isActive: user.isActive,
      isApproved: user.isApproved,
      registrationDate: user.registrationDate,
      lastLogin: user.lastLogin,
      canRequestExtensions: user.canRequestExtensions,
      canApproveExtensions: user.canApproveExtensions,
      profilePicture: user.profilePicture,
      idDocument: user.idDocument,
      registrationReason: user.registrationReason,
      lastProfileUpdate: user.lastProfileUpdate
    };
    global.__profileCache.set(key, { ts: now, data: safeUser });
    res.json({ success: true, user: safeUser });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    // Remove sensitive fields that shouldn't be updated via this endpoint
    delete updates.password;
    delete updates.role;
    delete updates.isApproved;
    delete updates.isActive;

    // Validate email uniqueness if email is being updated
    if (updates.email) {
      const existingUser = await User.findOne({
        email: updates.email,
        _id: { $ne: userId }
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        ...updates,
        lastProfileUpdate: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Clear profile cache
    if (global.__profileCache) {
      global.__profileCache.delete(userId);
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        phone: user.phone,
        designation: user.designation,
        accessLevel: user.accessLevel,
        assignedDevices: user.assignedDevices,
        isActive: user.isActive,
        isApproved: user.isApproved,
        registrationDate: user.registrationDate,
        lastLogin: user.lastLogin,
        canRequestExtensions: user.canRequestExtensions,
        canApproveExtensions: user.canApproveExtensions,
        profilePicture: user.profilePicture,
        idDocument: user.idDocument,
        registrationReason: user.registrationReason,
        lastProfileUpdate: user.lastProfileUpdate
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 3600000; // 1 hour

    await user.save();

    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
    const emailSent = await sendPasswordResetEmail(user.email, resetUrl);

    if (!emailSent) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      return res.status(500).json({ message: 'Email could not be sent' });
    }

    res.status(200).json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resetToken)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    if (req.body.password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      message: 'Password has been reset'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getPendingPermissionRequests = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userDepartment = req.user.department;

    const requests = await PermissionRequest.getPendingRequestsForUser(req.user.id, userRole);

    res.json({
      success: true,
      requests
    });
  } catch (error) {
    console.error('Error fetching permission requests:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const approvePermissionRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { comments } = req.body;

    const request = await PermissionRequest.findById(requestId).populate('userId');
    if (!request) {
      return res.status(404).json({ message: 'Permission request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }

    // Check if user can approve this request
    if (!request.canBeApprovedBy(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to approve this request' });
    }

    // Update request status
    request.status = 'approved';
    request.approvedBy = req.user.id;
    request.approvedAt = new Date();

    if (comments) {
      request.comments.push({
        userId: req.user.id,
        comment: comments
      });
    }

    await request.save();

    // Update user status
    const user = request.userId;
    user.isApproved = true;
    user.isActive = true;
    user.approvedBy = req.user.id;
    user.approvedAt = new Date();

    // Set additional permissions based on role
    if (user.role === 'faculty' || user.role === 'hod' || user.role === 'dean' || user.role === 'principal') {
      user.canRequestExtensions = true;
    }

    if (['admin', 'principal', 'dean', 'hod'].includes(user.role)) {
      user.canApproveExtensions = true;
    }

    await user.save();

    // Create notification for the user
    await Notification.createPermissionNotification({
      recipient: user._id,
      requestId: request._id,
      requestType: 'approved',
      userName: user.name,
      requestDetails: request.requestDetails
    });

    // Log the approval
    await ActivityLog.create({
      userId: req.user.id,
      action: 'PERMISSION_REQUEST_APPROVED',
      details: `Approved permission request for user ${user.email}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Permission request approved successfully',
      request
    });
  } catch (error) {
    console.error('Error approving permission request:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const rejectPermissionRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { rejectionReason, comments } = req.body;

    const request = await PermissionRequest.findById(requestId).populate('userId');
    if (!request) {
      return res.status(404).json({ message: 'Permission request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }

    // Check if user can reject this request
    if (!request.canBeApprovedBy(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to reject this request' });
    }

    // Update request status
    request.status = 'rejected';
    request.rejectedAt = new Date();
    request.rejectionReason = rejectionReason;

    if (comments) {
      request.comments.push({
        userId: req.user.id,
        comment: comments
      });
    }

    await request.save();

    // Deactivate the user
    const user = request.userId;
    user.isActive = false;
    await user.save();

    // Create notification for the user
    await Notification.createPermissionNotification({
      recipient: user._id,
      requestId: request._id,
      requestType: 'rejected',
      userName: user.name,
      requestDetails: request.requestDetails
    });

    // Log the rejection
    await ActivityLog.create({
      userId: req.user.id,
      action: 'PERMISSION_REQUEST_REJECTED',
      details: `Rejected permission request for user ${user.email}. Reason: ${rejectionReason}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Permission request rejected successfully',
      request
    });
  } catch (error) {
    console.error('Error rejecting permission request:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const requestClassExtension = async (req, res) => {
  try {
    const {
      scheduleId,
      requestedEndTime,
      reason,
      roomNumber,
      subject,
      classDetails
    } = req.body;

    // Verify user can request extensions
    if (!req.user.canRequestExtensions) {
      return res.status(403).json({ message: 'You do not have permission to request class extensions' });
    }

    const Schedule = mongoose.model('Schedule');
    const schedule = await Schedule.findById(scheduleId);

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    // Check if user owns this schedule or is authorized
    if (schedule.facultyId.toString() !== req.user.id && !['admin', 'principal', 'dean', 'hod'].includes(req.user.role)) {
      return res.status(403).json({ message: 'You can only request extensions for your own classes' });
    }

    const extensionRequest = await ClassExtensionRequest.create({
      requestedBy: req.user.id,
      scheduleId,
      originalEndTime: schedule.endTime,
      requestedEndTime: new Date(requestedEndTime),
      reason,
      roomNumber: roomNumber || schedule.roomNumber,
      subject: subject || schedule.subject,
      classDetails
    });

    // Check for conflicts
    const conflicts = await extensionRequest.checkConflicts();

    // Notify approvers
    const approvers = await User.find({
      role: { $in: ['hod', 'dean', 'principal', 'admin'] },
      department: req.user.department,
      isActive: true,
      canApproveExtensions: true
    });

    for (const approver of approvers) {
      await Notification.createExtensionNotification({
        recipient: approver._id,
        extensionId: extensionRequest._id,
        requestType: 'submitted',
        teacherName: req.user.name,
        roomNumber: extensionRequest.roomNumber,
        extensionDuration: extensionRequest.extensionDuration,
        reason
      });
    }

    // Auto-approve short extensions if no conflicts
    if (extensionRequest.extensionDuration <= 15 && conflicts.length === 0) {
      extensionRequest.status = 'auto_approved';
      extensionRequest.autoApproved = true;
      extensionRequest.approvedAt = new Date();
      await extensionRequest.save();

      // Update the schedule
      schedule.endTime = extensionRequest.requestedEndTime;
      await schedule.save();
    }

    // Log the extension request
    await ActivityLog.create({
      userId: req.user.id,
      action: 'CLASS_EXTENSION_REQUESTED',
      details: `Class extension requested for room ${extensionRequest.roomNumber}, duration: ${extensionRequest.extensionDuration} minutes`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      message: extensionRequest.status === 'auto_approved'
        ? 'Class extension auto-approved and applied'
        : 'Class extension request submitted for approval',
      request: extensionRequest,
      conflicts: conflicts.length
    });
  } catch (error) {
    console.error('Error requesting class extension:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getPendingExtensionRequests = async (req, res) => {
  try {
    const requests = await ClassExtensionRequest.getPendingRequestsForApproval(
      req.user.role,
      req.user.department
    );

    res.json({
      success: true,
      requests
    });
  } catch (error) {
    console.error('Error fetching extension requests:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const approveExtensionRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { comments } = req.body;

    const request = await ClassExtensionRequest.findById(requestId)
      .populate('requestedBy', 'name email department')
      .populate('scheduleId');

    if (!request) {
      return res.status(404).json({ message: 'Extension request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }

    // Check if user can approve this request
    if (!request.canBeApprovedBy(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to approve this extension' });
    }

    // Check for conflicts again
    const conflicts = await request.checkConflicts();
    if (conflicts.length > 0) {
      return res.status(400).json({
        message: 'Cannot approve extension due to scheduling conflicts',
        conflicts
      });
    }

    // Update request status
    request.status = 'approved';
    request.approvedBy = req.user.id;
    request.approvedAt = new Date();

    if (comments) {
      request.comments.push({
        userId: req.user.id,
        comment: comments
      });
    }

    await request.save();

    // Update the schedule
    const Schedule = mongoose.model('Schedule');
    await Schedule.findByIdAndUpdate(request.scheduleId, {
      endTime: request.requestedEndTime
    });

    // Create notification for the teacher
    await Notification.createExtensionNotification({
      recipient: request.requestedBy._id,
      extensionId: request._id,
      requestType: 'approved',
      teacherName: request.requestedBy.name,
      roomNumber: request.roomNumber,
      extensionDuration: request.extensionDuration,
      reason: request.reason
    });

    // Log the approval
    await ActivityLog.create({
      userId: req.user.id,
      action: 'CLASS_EXTENSION_APPROVED',
      details: `Approved class extension for room ${request.roomNumber}, duration: ${request.extensionDuration} minutes`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Class extension approved successfully',
      request
    });
  } catch (error) {
    console.error('Error approving extension request:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const rejectExtensionRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { rejectionReason, comments } = req.body;

    const request = await ClassExtensionRequest.findById(requestId)
      .populate('requestedBy', 'name email');

    if (!request) {
      return res.status(404).json({ message: 'Extension request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }

    // Check if user can reject this request
    if (!request.canBeApprovedBy(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to reject this extension' });
    }

    // Update request status
    request.status = 'rejected';
    request.rejectedAt = new Date();
    request.rejectionReason = rejectionReason;

    if (comments) {
      request.comments.push({
        userId: req.user.id,
        comment: comments
      });
    }

    await request.save();

    // Create notification for the teacher
    await Notification.createExtensionNotification({
      recipient: request.requestedBy._id,
      extensionId: request._id,
      requestType: 'rejected',
      teacherName: request.requestedBy.name,
      roomNumber: request.roomNumber,
      extensionDuration: request.extensionDuration,
      reason: request.reason
    });

    // Log the rejection
    await ActivityLog.create({
      userId: req.user.id,
      action: 'CLASS_EXTENSION_REJECTED',
      details: `Rejected class extension for room ${request.roomNumber}. Reason: ${rejectionReason}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Class extension rejected successfully',
      request
    });
  } catch (error) {
    console.error('Error rejecting extension request:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getNotifications = async (req, res) => {
  try {
    const { limit = 50, unreadOnly = false } = req.query;

    let query = { recipient: req.user.id };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOne({
      _id: notificationId,
      recipient: req.user.id
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await notification.markAsRead();

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getUnreadNotificationCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user.id,
      isRead: false
    });

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Error getting notification count:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  forgotPassword,
  resetPassword,
  getPendingPermissionRequests,
  approvePermissionRequest,
  rejectPermissionRequest,
  requestClassExtension,
  getPendingExtensionRequests,
  approveExtensionRequest,
  rejectExtensionRequest,
  getNotifications,
  markNotificationAsRead,
  getUnreadNotificationCount
};
