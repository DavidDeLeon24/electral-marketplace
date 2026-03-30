const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    reviewer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reviewee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    part: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Part'
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

reviewSchema.index({ reviewer: 1, part: 1 }, { unique: true, sparse: true });

reviewSchema.statics.getAverageRating = async function(userId) {
    const result = await this.aggregate([
        { $match: { reviewee: userId, isActive: true } },
        { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    return result.length > 0 ? { average: result[0].avgRating, count: result[0].count } : { average: 0, count: 0 };
};

reviewSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('Review', reviewSchema);