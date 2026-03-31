const express = require('express');
const router = express.Router();
const reviews = require('../controllers/reviews.controller');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, reviews.createReview);
router.get('/car/:id', reviews.getCarReviews);

module.exports = router;
