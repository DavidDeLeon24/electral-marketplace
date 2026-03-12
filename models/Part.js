const mongoose = require('mongoose');

const partSchema = new mongoose.Schema({
    partName: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        enum: ['CPU', 'GPU', 'Memory', 'Storage', 'Phone Parts', 'Motherboard', 'PSU', 'Cooler', 'Monitor', 'Other']
    },
    condition: {
        type: String,
        required: true,
        enum: ['New', 'Used', 'Refurbished', 'For Parts']
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        trim: true
    },
    imageURL: {
        type: String,
        trim: true
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for search functionality
partSchema.index({ partName: 'text', description: 'text' });

// Virtual for seller info (populated when needed)
partSchema.virtual('sellerInfo', {
    ref: 'User',
    localField: 'seller',
    foreignField: '_id',
    justOne: true
});

// Ensure virtuals are included in JSON
partSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('Part', partSchema);