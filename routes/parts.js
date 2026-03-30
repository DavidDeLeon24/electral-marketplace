const express = require('express');
const Part = require('../models/Part');
const authenticateToken = require('../middleware/auth');
const router = express.Router();

// GET all parts (public)
router.get('/', async (req, res) => {
    try {
        const { category, condition, search } = req.query;
        const query = { isActive: true };
        
        if (category) query.category = category;
        if (condition) query.condition = condition;
        
        let partsQuery = Part.find(query)
            .populate('seller', 'username email')
            .sort('-createdAt');
            
        if (search) {
            partsQuery = Part.find(
                { $text: { $search: search }, isActive: true }
            ).populate('seller', 'username email');
        }

        const parts = await partsQuery;
        res.json({ count: parts.length, parts });
    } catch (error) {
        console.error('Error fetching parts:', error);
        res.status(500).json({ message: 'Error fetching parts' });
    }
});

// GET single part
router.get('/:id', async (req, res) => {
    try {
        const part = await Part.findById(req.params.id)
            .populate('seller', 'username email');
        
        if (!part || !part.isActive) {
            return res.status(404).json({ message: 'Part not found' });
        }
        
        res.json(part);
    } catch (error) {
        console.error('Error fetching part:', error);
        res.status(500).json({ message: 'Error fetching part' });
    }
});

// GET parts by category
router.get('/category/:category', async (req, res) => {
    try {
        const parts = await Part.find({ 
            category: req.params.category,
            isActive: true 
        }).populate('seller', 'username');

        res.json({
            category: req.params.category,
            count: parts.length,
            parts
        });
    } catch (error) {
        console.error('Error fetching parts by category:', error);
        res.status(500).json({ message: 'Error fetching parts' });
    }
});

// POST new part (protected)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { partName, category, condition, price, description, imageURL } = req.body;

        const part = new Part({
            partName,
            category,
            condition,
            price,
            description,
            imageURL,
            seller: req.user.userId
        });

        await part.save();
        
        await part.populate('seller', 'username');

        res.status(201).json({
            message: 'Part listed successfully',
            part
        });
    } catch (error) {
        console.error('Error creating part:', error);
        res.status(500).json({ message: 'Error creating part listing' });
    }
});

// PUT update part (protected)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const part = await Part.findById(req.params.id);

        if (!part) {
            return res.status(404).json({ message: 'Part not found' });
        }

        if (part.seller.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized to update this part' });
        }

        const { partName, category, condition, price, description, imageURL } = req.body;
        
        if (partName) part.partName = partName;
        if (category) part.category = category;
        if (condition) part.condition = condition;
        if (price) part.price = price;
        if (description) part.description = description;
        if (imageURL) part.imageURL = imageURL;

        await part.save();

        res.json({ message: 'Part updated successfully', part });
    } catch (error) {
        console.error('Error updating part:', error);
        res.status(500).json({ message: 'Error updating part' });
    }
});

// DELETE part (protected)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const part = await Part.findById(req.params.id);

        if (!part) {
            return res.status(404).json({ message: 'Part not found' });
        }

        if (part.seller.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized to delete this part' });
        }

        part.isActive = false;
        await part.save();

        res.json({ message: 'Part deleted successfully' });
    } catch (error) {
        console.error('Error deleting part:', error);
        res.status(500).json({ message: 'Error deleting part' });
    }
});

module.exports = router;