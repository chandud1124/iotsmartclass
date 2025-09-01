
const express = require('express');
const {
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
} = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validationHandler');
const { body, param } = require('express-validator');

const router = express.Router();

// Validation middleware
const registerValidation = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['admin', 'principal', 'dean', 'hod', 'faculty', 'security', 'student', 'user']).withMessage('Invalid role'),
  body('department').trim().isLength({ min: 2 }).withMessage('Department must be at least 2 characters'),
  body('employeeId').optional().trim().isLength({ min: 1 }).withMessage('Employee ID is required for non-student roles'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('designation').optional().trim().isLength({ min: 2 }).withMessage('Designation must be at least 2 characters'),
  body('reason').optional().trim().isLength({ min: 1 }).withMessage('Reason is required')
];

const loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').exists().withMessage('Password is required')
];

const extensionRequestValidation = [
  body('scheduleId').isMongoId().withMessage('Invalid schedule ID'),
  body('requestedEndTime').isISO8601().withMessage('Invalid date format'),
  body('reason').trim().isLength({ min: 10 }).withMessage('Reason must be at least 10 characters'),
  body('roomNumber').trim().isLength({ min: 1 }).withMessage('Room number is required'),
  body('subject').optional().trim().isLength({ min: 1 }).withMessage('Subject is required')
];

const permissionActionValidation = [
  body('comments').optional().trim().isLength({ min: 1 }).withMessage('Comments cannot be empty'),
  body('rejectionReason').optional().trim().isLength({ min: 5 }).withMessage('Rejection reason must be at least 5 characters')
];

// Routes
router.post('/register',
  registerValidation,
  handleValidationErrors,
  register
);
router.post('/login', loginValidation, handleValidationErrors, login);
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.post('/forgot-password',
  [body('email').isEmail().withMessage('Please provide a valid email')],
  handleValidationErrors,
  forgotPassword
);
router.post('/reset-password/:resetToken',
  [body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')],
  handleValidationErrors,
  resetPassword
);

// Permission request routes
router.get('/permission-requests/pending', auth, getPendingPermissionRequests);
router.put('/permission-requests/:requestId/approve', auth, permissionActionValidation, handleValidationErrors, approvePermissionRequest);
router.put('/permission-requests/:requestId/reject', auth, permissionActionValidation, handleValidationErrors, rejectPermissionRequest);

// Class extension routes
router.post('/class-extensions', auth, extensionRequestValidation, handleValidationErrors, requestClassExtension);
router.get('/class-extensions/pending', auth, getPendingExtensionRequests);
router.put('/class-extensions/:requestId/approve', auth, permissionActionValidation, handleValidationErrors, approveExtensionRequest);
router.put('/class-extensions/:requestId/reject', auth, permissionActionValidation, handleValidationErrors, rejectExtensionRequest);

// Notification routes
router.get('/notifications', auth, getNotifications);
router.put('/notifications/:notificationId/read', auth, markNotificationAsRead);
router.get('/notifications/unread-count', auth, getUnreadNotificationCount);

module.exports = router;
