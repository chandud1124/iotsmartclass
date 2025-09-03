const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { logger } = require('../middleware/logger');

// Helper function to sanitize ticket data
const sanitizeTicket = (ticket) => ({
    id: ticket._id,
    ticketId: ticket.ticketId,
    title: ticket.title,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    createdBy: ticket.createdBy,
    assignedTo: ticket.assignedTo,
    department: ticket.department,
    location: ticket.location,
    deviceId: ticket.deviceId,
    tags: ticket.tags,
    resolution: ticket.resolution,
    resolvedAt: ticket.resolvedAt,
    closedAt: ticket.closedAt,
    estimatedHours: ticket.estimatedHours,
    actualHours: ticket.actualHours,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    daysOpen: ticket.daysOpen,
    comments: ticket.comments?.map(comment => ({
        id: comment._id,
        author: comment.author,
        authorName: comment.authorName,
        message: comment.message,
        isInternal: comment.isInternal,
        createdAt: comment.createdAt
    })) || []
});

// Create a new ticket
const createTicket = async (req, res) => {
    try {
        const {
            title,
            description,
            category,
            priority = 'medium',
            department,
            location,
            deviceId,
            tags = []
        } = req.body;

        // Validate required fields
        if (!title || !description || !category) {
            return res.status(400).json({
                error: 'Validation failed',
                details: 'Title, description, and category are required'
            });
        }

        // Validate category
        const validCategories = [
            'technical_issue', 'device_problem', 'network_issue',
            'software_bug', 'feature_request', 'account_issue',
            'security_concern', 'other'
        ];
        if (!validCategories.includes(category)) {
            return res.status(400).json({
                error: 'Validation failed',
                details: 'Invalid category'
            });
        }

        // Create ticket
        const ticket = new Ticket({
            title,
            description,
            category,
            priority,
            department: department || req.user.department,
            location,
            deviceId,
            tags,
            createdBy: req.user.id,
            comments: [{
                author: req.user.id,
                authorName: req.user.name,
                message: 'Ticket created',
                isInternal: false
            }]
        });

        await ticket.save();

        // Populate references
        await ticket.populate('createdBy', 'name email role');
        await ticket.populate('assignedTo', 'name email role');
        await ticket.populate('deviceId', 'name location');

        // Emit notification to admins
        if (req.app.get('io')) {
            req.app.get('io').emit('system_notification', {
                type: 'system_alert',
                message: `New support ticket created: ${ticket.title}`,
                severity: ticket.priority === 'urgent' ? 'high' : 'medium',
                metadata: {
                    ticketId: ticket.ticketId,
                    category: ticket.category,
                    priority: ticket.priority,
                    createdBy: req.user.name
                },
                timestamp: new Date()
            });
        }

        res.status(201).json({
            success: true,
            data: sanitizeTicket(ticket)
        });

    } catch (error) {
        logger.error('[createTicket] error:', error);
        res.status(500).json({
            error: 'Server error',
            details: error.message
        });
    }
};

// Get all tickets (with role-based filtering)
const getTickets = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
        const status = req.query.status;
        const category = req.query.category;
        const priority = req.query.priority;
        const search = req.query.search;

        let query = {};

        // Role-based filtering
        if (req.user.role !== 'admin') {
            // Non-admins can only see tickets they created or are assigned to
            query.$or = [
                { createdBy: req.user.id },
                { assignedTo: req.user.id }
            ];
        }

        // Apply filters
        if (status) query.status = status;
        if (category) query.category = category;
        if (priority) query.priority = priority;

        // Search functionality
        if (search) {
            query.$or = query.$or || [];
            query.$or.push(
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { ticketId: { $regex: search, $options: 'i' } }
            );
        }

        const total = await Ticket.countDocuments(query);
        const tickets = await Ticket.find(query)
            .populate('createdBy', 'name email role department')
            .populate('assignedTo', 'name email role department')
            .populate('deviceId', 'name location classroom')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({
            success: true,
            data: tickets.map(sanitizeTicket),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        logger.error('[getTickets] error:', error);
        res.status(500).json({
            error: 'Server error',
            details: error.message
        });
    }
};

// Get single ticket
const getTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id)
            .populate('createdBy', 'name email role department')
            .populate('assignedTo', 'name email role department')
            .populate('deviceId', 'name location classroom');

        if (!ticket) {
            return res.status(404).json({
                error: 'Not found',
                details: 'Ticket not found'
            });
        }

        // Check permissions
        if (req.user.role !== 'admin' &&
            ticket.createdBy._id.toString() !== req.user.id &&
            ticket.assignedTo?._id?.toString() !== req.user.id) {
            return res.status(403).json({
                error: 'Forbidden',
                details: 'You do not have permission to view this ticket'
            });
        }

        res.json({
            success: true,
            data: sanitizeTicket(ticket)
        });

    } catch (error) {
        logger.error('[getTicket] error:', error);
        res.status(500).json({
            error: 'Server error',
            details: error.message
        });
    }
};

// Update ticket (admin only for assignment/status, users can add comments)
const updateTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) {
            return res.status(404).json({
                error: 'Not found',
                details: 'Ticket not found'
            });
        }

        const {
            status,
            assignedTo,
            priority,
            resolution,
            estimatedHours,
            actualHours,
            comment
        } = req.body;

        // Check permissions
        const canUpdateStatus = req.user.role === 'admin';
        const canUpdateAssignment = req.user.role === 'admin';
        const isCreator = ticket.createdBy.toString() === req.user.id;
        const isAssignee = ticket.assignedTo?.toString() === req.user.id;

        if (!canUpdateStatus && !canUpdateAssignment && !isCreator && !isAssignee) {
            return res.status(403).json({
                error: 'Forbidden',
                details: 'You do not have permission to update this ticket'
            });
        }

        // Update fields based on permissions
        if (canUpdateStatus && status) {
            ticket.status = status;
            if (status === 'resolved' || status === 'closed') {
                ticket.resolvedAt = new Date();
                if (status === 'closed') {
                    ticket.closedAt = new Date();
                }
            }
        }

        if (canUpdateAssignment && assignedTo !== undefined) {
            ticket.assignedTo = assignedTo;
        }

        if (canUpdateStatus && priority) {
            ticket.priority = priority;
        }

        if (canUpdateStatus && resolution) {
            ticket.resolution = resolution;
        }

        if (canUpdateStatus && estimatedHours !== undefined) {
            ticket.estimatedHours = estimatedHours;
        }

        if (canUpdateStatus && actualHours !== undefined) {
            ticket.actualHours = actualHours;
        }

        // Add comment if provided
        if (comment) {
            ticket.comments.push({
                author: req.user.id,
                authorName: req.user.name,
                message: comment,
                isInternal: req.user.role === 'admin' && req.body.isInternal
            });
        }

        await ticket.save();

        // Populate references
        await ticket.populate('createdBy', 'name email role department');
        await ticket.populate('assignedTo', 'name email role department');
        await ticket.populate('deviceId', 'name location classroom');

        // Emit notification for status changes
        if (req.app.get('io') && status && status !== ticket.status) {
            req.app.get('io').emit('system_notification', {
                type: 'system_alert',
                message: `Ticket ${ticket.ticketId} status changed to ${status}`,
                severity: 'medium',
                metadata: {
                    ticketId: ticket.ticketId,
                    oldStatus: ticket.status,
                    newStatus: status,
                    updatedBy: req.user.name
                },
                timestamp: new Date()
            });
        }

        res.json({
            success: true,
            data: sanitizeTicket(ticket)
        });

    } catch (error) {
        logger.error('[updateTicket] error:', error);
        res.status(500).json({
            error: 'Server error',
            details: error.message
        });
    }
};

// Delete ticket (admin only)
const deleteTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) {
            return res.status(404).json({
                error: 'Not found',
                details: 'Ticket not found'
            });
        }

        // Only admins can delete tickets
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                error: 'Forbidden',
                details: 'Only administrators can delete tickets'
            });
        }

        await ticket.deleteOne();

        res.json({
            success: true,
            message: 'Ticket deleted successfully'
        });

    } catch (error) {
        logger.error('[deleteTicket] error:', error);
        res.status(500).json({
            error: 'Server error',
            details: error.message
        });
    }
};

// Get ticket statistics (admin only)
const getTicketStats = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                error: 'Forbidden',
                details: 'Only administrators can view ticket statistics'
            });
        }

        const stats = await Ticket.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
                    inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
                    resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
                    closed: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
                    urgent: { $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] } },
                    high: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } },
                    avgResolutionTime: {
                        $avg: {
                            $cond: [
                                { $and: [{ $ne: ['$resolvedAt', null] }, { $ne: ['$createdAt', null] }] },
                                { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000 * 60 * 60 * 24] },
                                null
                            ]
                        }
                    }
                }
            }
        ]);

        res.json({
            success: true,
            data: stats[0] || {
                total: 0,
                open: 0,
                inProgress: 0,
                resolved: 0,
                closed: 0,
                urgent: 0,
                high: 0,
                avgResolutionTime: 0
            }
        });

    } catch (error) {
        logger.error('[getTicketStats] error:', error);
        res.status(500).json({
            error: 'Server error',
            details: error.message
        });
    }
};

module.exports = {
    createTicket,
    getTickets,
    getTicket,
    updateTicket,
    deleteTicket,
    getTicketStats
};
