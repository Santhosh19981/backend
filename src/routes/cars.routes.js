const express = require('express');
const router = express.Router();
const cars = require('../controllers/cars.controller');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', cars.getCars);
router.get('/owner/my-cars', authenticate, requireRole('owner'), cars.getOwnerCars);
router.get('/:id', cars.getCarById);
router.get('/:id/availability', cars.getAvailability);
router.post('/', authenticate, requireRole('owner'),
  upload.fields([{ name: 'images', maxCount: 10 }, { name: 'documents', maxCount: 5 }]),
  cars.createCar
);
router.put('/:id/status', authenticate, requireRole('admin'), cars.updateCarStatus);

module.exports = router;
