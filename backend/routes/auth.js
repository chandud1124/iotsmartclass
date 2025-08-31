
const express = require('express');
const multer = require('multer');
const path = require('path');
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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    // Create directory if it doesn't exist
    require('fs').mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images and PDFs only
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only image and PDF files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 2 // Maximum 2 files
  }
});

const router = express.Router();

// Validation middleware
const registerValidation = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['admin', 'principal', 'dean', 'hod', 'faculty', 'security', 'student', 'user']).withMessage('Invalid role'),
  body('department').optional().trim().isLength({ min: 2 }).withMessage('Department must be at least 2 characters'),
  body('employeeId').optional().trim().isLength({ min: 1 }).withMessage('Employee ID is required'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('designation').optional().trim().isLength({ min: 2 }).withMessage('Designation must be at least 2 characters')
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
  upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'idDocument', maxCount: 1 }
  ]),
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
