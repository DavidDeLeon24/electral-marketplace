const express = require('express');
const User = require('../models/User');
const Part = require('../models/Part');
const authenticateToken = require('../middleware/auth');
const router = express.Router();

// GET current user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        
        const listings = await Part.find({ 
            seller: req.user.userId,
            isActive: true 
        }).sort('-createdAt');

        const userData = user.toJSON();
        userData.listings = listings;
        userData.id = user._id;

        res.json(userData);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Error fetching profile' });
    }
});

// UPDATE user profile
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { firstName, lastName, phone } = req.body;
        
        const user = await User.findById(req.user.userId);
        
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (phone) user.phone = phone;
        
        await user.save();
        
        res.json({ message: 'Profile updated successfully', user: user.toJSON() });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Error updating profile' });
    }
});

module.exports = router;