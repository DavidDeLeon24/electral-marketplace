const express = require('express');
const Review = require('../models/Review');
const User = require('../models/User');
const Part = require('../models/Part');
const authenticateToken = require('../middleware/auth');
const router = express.Router();

// GET reviews for a user
router.get('/user/:userId', async (req, res) => {
    try {
        const reviews = await Review.find({ 
            reviewee: req.params.userId, 
            isActive: true 
        })
        .populate('reviewer', 'username firstName lastName')
        .populate('part', 'partName')
        .sort('-createdAt');

        const ratingStats = await Review.getAverageRating(req.params.userId);

        res.json({
            reviews,
            averageRating: ratingStats.average,
            totalReviews: ratingStats.count
        });

    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ message: 'Error fetching reviews' });
    }
});

// GET all reviews
router.get('/', async (req, res) => {
    try {
        const { minRating, maxRating, partId, reviewerId, revieweeId } = req.query;
        const query = { isActive: true };

        if (minRating) query.rating = { ...query.rating, $gte: parseInt(minRating) };
        if (maxRating) query.rating = { ...query.rating, $lte: parseInt(maxRating) };
        if (partId) query.part = partId;
        if (reviewerId) query.reviewer = reviewerId;
        if (revieweeId) query.reviewee = revieweeId;

        const reviews = await Review.find(query)
            .populate('reviewer', 'username firstName lastName')
            .populate('reviewee', 'username firstName lastName')
            .populate('part', 'partName price')
            .sort('-createdAt')
            .limit(50);

        res.json({
            count: reviews.length,
            reviews
        });

    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ message: 'Error fetching reviews' });
    }
});

// POST create a review
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { revieweeId, partId, rating, comment } = req.body;

        if (revieweeId === req.user.userId) {
            return res.status(400).json({ message: 'You cannot review yourself' });
        }

        const reviewee = await User.findById(revieweeId);
        if (!reviewee) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (partId) {
            const part = await Part.findById(partId);
            if (!part) {
                return res.status(404).json({ message: 'Part not found' });
            }
        }

        const existingReview = await Review.findOne({
            reviewer: req.user.userId,
            ...(partId ? { part: partId } : { reviewee: revieweeId })
        });

        if (existingReview) {
            return res.status(400).json({ message: 'You have already reviewed this' });
        }

        const review = new Review({
            reviewer: req.user.userId,
            reviewee: revieweeId,
            part: partId,
            rating,
            comment
        });

        await review.save();
        await review.populate('reviewer', 'username');
        await review.populate('part', 'partName');

        res.status(201).json({
            message: 'Review submitted successfully',
            review
        });

    } catch (error) {
        console.error('Error creating review:', error);
        res.status(500).json({ message: 'Error creating review' });
    }
});

// DELETE review
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);

        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        if (review.reviewer.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        review.isActive = false;
        await review.save();

        res.json({ message: 'Review deleted successfully' });

    } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({ message: 'Error deleting review' });
    }
});

// GET average rating for user
router.get('/user/:userId/rating', async (req, res) => {
    try {
        const stats = await Review.getAverageRating(req.params.userId);
        res.json(stats);
    } catch (error) {
        console.error('Error fetching rating:', error);
        res.status(500).json({ message: 'Error fetching rating' });
    }
});

module.exports = router;