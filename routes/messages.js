const express = require('express');
const Message = require('../models/Message');
const User = require('../models/User');
const Part = require('../models/Part');
const authenticateToken = require('../middleware/auth');
const router = express.Router();

// GET all messages for current user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const messages = await Message.find({
            $or: [
                { sender: req.user.userId },
                { receiver: req.user.userId }
            ]
        })
        .populate('sender', 'username email')
        .populate('receiver', 'username email')
        .populate('part', 'partName price')
        .sort('-createdAt');

        const conversations = {};
        messages.forEach(message => {
            const otherUserId = message.sender._id.toString() === req.user.userId 
                ? message.receiver._id.toString() 
                : message.sender._id.toString();
            
            if (!conversations[otherUserId]) {
                conversations[otherUserId] = {
                    user: message.sender._id.toString() === req.user.userId ? message.receiver : message.sender,
                    lastMessage: message,
                    unreadCount: 0,
                    messages: []
                };
            }
            
            conversations[otherUserId].messages.push(message);
            
            if (!message.isRead && message.receiver._id.toString() === req.user.userId) {
                conversations[otherUserId].unreadCount++;
            }
        });

        res.json({
            conversations: Object.values(conversations),
            totalUnread: messages.filter(m => !m.isRead && m.receiver._id.toString() === req.user.userId).length
        });

    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Error fetching messages' });
    }
});

// GET conversation with specific user
router.get('/conversation/:userId', authenticateToken, async (req, res) => {
    try {
        const otherUser = await User.findById(req.params.userId).select('username email firstName lastName');
        if (!otherUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const messages = await Message.find({
            $or: [
                { sender: req.user.userId, receiver: req.params.userId },
                { sender: req.params.userId, receiver: req.user.userId }
            ]
        })
        .populate('sender', 'username')
        .populate('receiver', 'username')
        .populate('part', 'partName')
        .sort('createdAt');

        await Message.updateMany(
            { sender: req.params.userId, receiver: req.user.userId, isRead: false },
            { isRead: true }
        );

        res.json({
            user: otherUser,
            messages
        });

    } catch (error) {
        console.error('Error fetching conversation:', error);
        res.status(500).json({ message: 'Error fetching conversation' });
    }
});

// POST send new message
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { receiverId, partId, content } = req.body;

        const receiver = await User.findById(receiverId);
        if (!receiver) {
            return res.status(404).json({ message: 'Receiver not found' });
        }

        if (partId) {
            const part = await Part.findById(partId);
            if (!part) {
                return res.status(404).json({ message: 'Part not found' });
            }
        }

        const message = new Message({
            sender: req.user.userId,
            receiver: receiverId,
            part: partId,
            content
        });

        await message.save();
        await message.populate('sender', 'username');

        res.status(201).json({
            message: 'Message sent successfully',
            data: message
        });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Error sending message' });
    }
});

// PUT mark message as read
router.put('/:id/read', authenticateToken, async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        if (message.receiver.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        message.isRead = true;
        await message.save();

        res.json({ message: 'Message marked as read' });

    } catch (error) {
        console.error('Error marking message:', error);
        res.status(500).json({ message: 'Error updating message' });
    }
});

// GET unread count
router.get('/unread/count', authenticateToken, async (req, res) => {
    try {
        const count = await Message.countDocuments({
            receiver: req.user.userId,
            isRead: false
        });

        res.json({ unreadCount: count });

    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ message: 'Error fetching unread count' });
    }
});

module.exports = router;