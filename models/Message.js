const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',     //User who sent the message
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',       //User who recieves the message
        required: true
    },
    part: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Part'
    },
    content: {
        type: String,
        required: true,    //message text
        trim: true,
        maxlength: 2000     //charac limit
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, isRead: 1 });

messageSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('Message', messageSchema);
