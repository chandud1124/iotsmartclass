
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true // Index for email lookups
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['admin', 'principal', 'dean', 'hod', 'faculty', 'security', 'student', 'user'],
    default: 'user',
    index: true // Index for role-based queries
  },
  department: {
    type: String,
    trim: true,
    index: true
  },
  employeeId: {
    type: String,
    trim: true,
    sparse: true // Allow null values but ensure uniqueness when present
  },
  phone: {
    type: String,
    trim: true
  },
  designation: {
    type: String,
    trim: true
  },
  accessLevel: {
    type: String,
    enum: ['full', 'limited', 'readonly'],
    default: 'limited'
  },
  assignedDevices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device'
  }],
  assignedRooms: [{
    type: String,
    trim: true
  }],
  classroomPermissions: {
    canAccessAllClassrooms: { type: Boolean, default: false },
    departmentOverride: { type: Boolean, default: false },
    emergencyAccess: { type: Boolean, default: false },
    bypassTimeRestrictions: { type: Boolean, default: false }
  },
  isActive: {
    type: Boolean,
    default: false, // Users need approval to become active
    index: true // Index for active user queries
  },
  isApproved: {
    type: Boolean,
    default: false,
    index: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  lastLogin: {
    type: Date,
    default: Date.now,
    index: true // Index for login analytics
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  firstLoginResetRequired: {
    type: Boolean,
    default: false
  },
  canRequestExtensions: {
    type: Boolean,
    default: false // Only faculty can request extensions
  },
  canApproveExtensions: {
    type: Boolean,
    default: false // Admin, Principal, Dean, HOD can approve
  },
  notificationPreferences: {
    email: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true },
    securityAlerts: { type: Boolean, default: false } // Only security personnel
  },
  googleCalendarTokens: {
    access_token: String,
    refresh_token: String,
    scope: String,
    token_type: String,
    expiry_date: Number,
    obtainedAt: { type: Date }
  },
  registrationReason: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  lastProfileUpdate: {
    type: Date
  },
  isOnline: {
    type: Boolean,
    default: false,
    index: true
  },
  lastSeen: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
