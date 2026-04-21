const express = require('express');
const router = express.Router();
const admin = require('../controllers/admin.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const isAdmin = [authenticate, requireRole('admin')];

router.get('/dashboard', ...isAdmin, admin.getDashboard);
router.get('/cars/pending', ...isAdmin, admin.getPendingCars);
router.get('/users', ...isAdmin, admin.getUsers);
router.get('/bookings', ...isAdmin, admin.getAllBookings);
router.get('/commission', ...isAdmin, admin.getCommission);
router.put('/commission', ...isAdmin, admin.updateCommission);
router.get('/reports', ...isAdmin, admin.getReports);

module.exports = router;
