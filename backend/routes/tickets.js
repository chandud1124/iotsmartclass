const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const {
    createTicket,
    getTickets,
    getTicket,
    updateTicket,
    deleteTicket,
    getTicketStats
} = require('../controllers/ticketController');

// All routes require authentication
router.use(auth);

// Validation middleware
const createTicketValidation = [
    require('express-validator').body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be less than 200 characters'),
    require('express-validator').body('description').trim().isLength({ min: 1, max: 2000 }).withMessage('Description is required and must be less than 2000 characters'),
    require('express-validator').body('category').isIn([
        'technical_issue', 'device_problem', 'network_issue',
        'software_bug', 'feature_request', 'account_issue',
        'security_concern', 'other'
    ]).withMessage('Invalid category'),
    require('express-validator').body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority')
];

const updateTicketValidation = [
    require('express-validator').body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed', 'cancelled']).withMessage('Invalid status'),
    require('express-validator').body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    require('express-validator').body('comment').optional().trim().isLength({ max: 1000 }).withMessage('Comment must be less than 1000 characters')
];

// Routes
router.post('/', createTicketValidation, require('../middleware/validationHandler').handleValidationErrors, createTicket);
router.get('/', getTickets);
router.get('/stats', authorize('admin'), getTicketStats);
router.get('/:id', getTicket);
router.put('/:id', updateTicketValidation, require('../middleware/validationHandler').handleValidationErrors, updateTicket);
router.delete('/:id', authorize('admin'), deleteTicket);

module.exports = router;
