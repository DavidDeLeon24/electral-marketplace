const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');

// Import models
const User = require('./models/User');
const Part = require('./models/Part');
const Message = require('./models/Message');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ============= DATABASE CONNECTION =============
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        console.log(`📊 Database: ${process.env.MONGODB_URI.split('/').pop()}`);
    })
    .catch(err => {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1);
    });

// ============= AUTHENTICATION MIDDLEWARE =============
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-passwordHash');
        
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }
        
        req.user = decoded;
        req.userDoc = user;
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};

// ============= SEED DATA FUNCTION =============
async function seedDatabase() {
    try {
        // Check if we already have data
        const userCount = await User.countDocuments();
        if (userCount > 0) {
            console.log('📦 Database already has data, skipping seed');
            return;
        }

        console.log('🌱 Seeding database with sample data...');

        // Create users
        const users = await User.create([
            {
                email: 'john@example.com',
                username: 'john_tech',
                passwordHash: 'password123',
                firstName: 'John',
                lastName: 'Smith',
                isSeller: true
            },
            {
                email: 'jane@example.com',
                username: 'jane_electronics',
                passwordHash: 'password123',
                firstName: 'Jane',
                lastName: 'Doe',
                isSeller: true
            },
            {
                email: 'bob@example.com',
                username: 'bob_buyer',
                passwordHash: 'password123',
                firstName: 'Bob',
                lastName: 'Johnson',
                isSeller: false
            }
        ]);

        console.log(`✅ Created ${users.length} users`);

        // Create parts
        const parts = await Part.create([
            {
                partName: 'Intel Core i7-12700K',
                category: 'CPU',
                condition: 'New',
                price: 329.99,
                description: '12th Gen Intel Core i7 Processor, 12 cores, 20 threads',
                seller: users[0]._id
            },
            {
                partName: 'NVIDIA RTX 3060 12GB',
                category: 'GPU',
                condition: 'Used',
                price: 249.99,
                description: 'Good condition, used for 6 months',
                seller: users[1]._id
            },
            {
                partName: 'Samsung 1TB NVMe SSD',
                category: 'Storage',
                condition: 'New',
                price: 89.99,
                description: 'M.2 NVMe PCIe 4.0',
                seller: users[0]._id
            },
            {
                partName: 'Corsair 16GB DDR4 RAM',
                category: 'Memory',
                condition: 'Refurbished',
                price: 54.99,
                description: '3200MHz, dual channel',
                seller: users[1]._id
            },
            {
                partName: 'iPhone 13 Display Assembly',
                category: 'Phone Parts',
                condition: 'New',
                price: 129.99,
                description: 'OEM Replacement Display',
                seller: users[0]._id
            }
        ]);

        console.log(`✅ Created ${parts.length} parts`);

        // Create sample messages
        await Message.create([
            {
                sender: users[1]._id,
                receiver: users[0]._id,
                part: parts[0]._id,
                content: 'Is the Intel i7 still available?',
                isRead: false
            },
            {
                sender: users[0]._id,
                receiver: users[1]._id,
                part: parts[1]._id,
                content: 'Yes, the RTX 3060 is still available',
                isRead: true
            }
        ]);

        console.log('✅ Database seeded successfully!');
    } catch (error) {
        console.error('❌ Error seeding database:', error.message);
    }
}

// ============= API ROUTES =============

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'running',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        endpoints: {
            auth: '/api/auth/*',
            parts: '/api/parts',
            users: '/api/users/*',
            messages: '/api/messages'
        }
    });
});

// ===== AUTH ROUTES =====
// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, username, firstName, lastName } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Create user
        const user = new User({
            email,
            username,
            passwordHash: password,
            firstName,
            lastName
        });

        await user.save();

        // Create token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        res.status(201).json({
            message: 'Registration successful',
            token,
            user: user.toJSON()
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email, isActive: true });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Check password
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Create token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        res.json({
            message: 'Login successful',
            token,
            user: user.toJSON()
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// GET /api/auth/verify
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ 
        valid: true, 
        user: req.userDoc.toJSON()
    });
});

// ===== PARTS ROUTES =====
// GET /api/parts (public)
app.get('/api/parts', async (req, res) => {
    try {
        const { category, condition, minPrice, maxPrice, search } = req.query;
        
        // Build query
        const query = { isActive: true };
        
        if (category) query.category = category;
        if (condition) query.condition = condition;
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseFloat(minPrice);
            if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }
        
        // Text search
        let partsQuery;
        if (search) {
            partsQuery = Part.find(
                { $text: { $search: search }, isActive: true }
            ).populate('seller', 'username email');
        } else {
            partsQuery = Part.find(query).populate('seller', 'username email');
        }

        const parts = await partsQuery.sort('-createdAt');

        res.json({
            count: parts.length,
            parts
        });

    } catch (error) {
        console.error('Error fetching parts:', error);
        res.status(500).json({ message: 'Error fetching parts' });
    }
});

// GET /api/parts/:id (public)
app.get('/api/parts/:id', async (req, res) => {
    try {
        const part = await Part.findById(req.params.id)
            .populate('seller', 'username email firstName lastName');

        if (!part || !part.isActive) {
            return res.status(404).json({ message: 'Part not found' });
        }

        res.json(part);

    } catch (error) {
        res.status(500).json({ message: 'Error fetching part' });
    }
});

// POST /api/parts (protected)
app.post('/api/parts', authenticateToken, async (req, res) => {
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

        res.status(201).json({
            message: 'Part listed successfully',
            part
        });

    } catch (error) {
        console.error('Error creating part:', error);
        res.status(500).json({ message: 'Error creating part listing' });
    }
});

// PUT /api/parts/:id (protected)
app.put('/api/parts/:id', authenticateToken, async (req, res) => {
    try {
        const part = await Part.findById(req.params.id);

        if (!part) {
            return res.status(404).json({ message: 'Part not found' });
        }

        // Check ownership
        if (part.seller.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized to update this part' });
        }

        // Update fields
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
        res.status(500).json({ message: 'Error updating part' });
    }
});

// DELETE /api/parts/:id (protected)
app.delete('/api/parts/:id', authenticateToken, async (req, res) => {
    try {
        const part = await Part.findById(req.params.id);

        if (!part) {
            return res.status(404).json({ message: 'Part not found' });
        }

        // Check ownership
        if (part.seller.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized to delete this part' });
        }

        // Soft delete
        part.isActive = false;
        await part.save();

        res.json({ message: 'Part deleted successfully' });

    } catch (error) {
        res.status(500).json({ message: 'Error deleting part' });
    }
});

// GET /api/parts/category/:category
app.get('/api/parts/category/:category', async (req, res) => {
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
        res.status(500).json({ message: 'Error fetching parts by category' });
    }
});

// ===== USER ROUTES =====
// GET /api/users/profile (protected)
app.get('/api/users/profile', authenticateToken, async (req, res) => {
    try {
        // Get user's parts
        const listings = await Part.find({ 
            seller: req.user.userId,
            isActive: true 
        }).sort('-createdAt');

        const userData = req.userDoc.toJSON();
        userData.listings = listings;

        res.json(userData);

    } catch (error) {
        res.status(500).json({ message: 'Error fetching profile' });
    }
});

// PUT /api/users/profile (protected)
app.put('/api/users/profile', authenticateToken, async (req, res) => {
    try {
        const { firstName, lastName, phone } = req.body;
        
        const user = req.userDoc;
        
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (phone) user.phone = phone;
        
        await user.save();
        
        res.json({ message: 'Profile updated successfully', user: user.toJSON() });

    } catch (error) {
        res.status(500).json({ message: 'Error updating profile' });
    }
});

// ===== MESSAGE ROUTES =====
// GET /api/messages (protected)
app.get('/api/messages', authenticateToken, async (req, res) => {
    try {
        const messages = await Message.find({
            $or: [
                { sender: req.user.userId },
                { receiver: req.user.userId }
            ]
        })
        .populate('sender', 'username')
        .populate('receiver', 'username')
        .populate('part', 'partName')
        .sort('-createdAt');

        res.json(messages);

    } catch (error) {
        res.status(500).json({ message: 'Error fetching messages' });
    }
});

// POST /api/messages (protected)
app.post('/api/messages', authenticateToken, async (req, res) => {
    try {
        const { receiverId, partId, content } = req.body;

        const message = new Message({
            sender: req.user.userId,
            receiver: receiverId,
            part: partId,
            content
        });

        await message.save();

        res.status(201).json({
            message: 'Message sent successfully',
            messageData: message
        });

    } catch (error) {
        res.status(500).json({ message: 'Error sending message' });
    }
});

// PUT /api/messages/:id/read (protected)
app.put('/api/messages/:id/read', authenticateToken, async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Only receiver can mark as read
        if (message.receiver.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        message.isRead = true;
        await message.save();

        res.json({ message: 'Message marked as read' });

    } catch (error) {
        res.status(500).json({ message: 'Error updating message' });
    }
});

// ============= SEED DATABASE ON STARTUP =============
seedDatabase();

// ============= START SERVER =============
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 API Documentation: http://localhost:${PORT}/api/health`);
    console.log(`🌐 Home page: http://localhost:${PORT}`);
});