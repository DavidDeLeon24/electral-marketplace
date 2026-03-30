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
const Review = require('./models/Review');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const partRoutes = require('./routes/parts');
const messageRoutes = require('./routes/messages');
const reviewRoutes = require('./routes/reviews');

// Import middleware
const { generalLimiter, authLimiter } = require('./middleware/rateLimiter');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// DATABASE CONNECTION
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
        const userCount = await User.countDocuments();
        if (userCount > 0) {
            console.log('📦 Database already has data, skipping seed');
            return;
        }

        console.log('🌱 Seeding database with sample data...');

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

        // Sample message
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

        // Sample reviews
        await Review.create([
            {
                reviewer: users[1]._id,
                reviewee: users[0]._id,
                part: parts[0]._id,
                rating: 5,
                comment: 'Great seller, fast shipping!'
            },
            {
                reviewer: users[2]._id,
                reviewee: users[1]._id,
                part: parts[1]._id,
                rating: 4,
                comment: 'Item as described, good condition'
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
            messages: '/api/messages',
            reviews: '/api/reviews'
        }
    });
});

// Apply rate limiter to all API routes
app.use('/api/', generalLimiter);

// Auth routes with stricter limiter
app.use('/api/auth', authLimiter);
app.use('/api/auth', authRoutes);

// Other routes
app.use('/api/parts', partRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reviews', reviewRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ 
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

// ============= SEED DATABASE ON STARTUP =============
seedDatabase();

// ============= START SERVER =============
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 API Documentation: http://localhost:${PORT}/api/health`);
    console.log(`🌐 Home page: http://localhost:${PORT}`);
});
