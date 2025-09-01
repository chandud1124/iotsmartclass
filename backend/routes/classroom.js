const express = require('express');
const router = express.Router();
const {
    getUserClassroomAccess,
    grantClassroomAccess,
    revokeClassroomAccess,
    getClassroomsSummary,
    getAllClassroomAccess
} = require('../controllers/classroomController');
const { auth, authorize } = require('../middleware/auth');
const { checkClassroomAccess } = require('../middleware/classroomAuth');

// Get classrooms summary (admin, principal, dean, hod, faculty)
router.get('/summary',
    auth,
    authorize('admin', 'principal', 'dean', 'hod', 'faculty'),
    getClassroomsSummary
);

// Get all classroom access records (admin, principal, dean, hod, faculty)
router.get('/all',
    auth,
    authorize('admin', 'principal', 'dean', 'hod', 'faculty'),
    getAllClassroomAccess
);

// Get user's classroom access
router.get('/user/:userId',
    auth,
    authorize('admin', 'principal', 'dean', 'hod', 'faculty'),
    getUserClassroomAccess
);

// Grant classroom access
router.post('/grant',
    auth,
    authorize('admin', 'principal', 'dean', 'hod', 'faculty'),
    grantClassroomAccess
);

// Revoke classroom access
router.delete('/:accessId',
    auth,
    authorize('admin', 'principal', 'dean', 'hod', 'faculty'),
    revokeClassroomAccess
);

module.exports = router;