const mongoose = require('mongoose');

const qrLoginSchema = new mongoose.Schema({
    qrToken: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['pending', 'scanned', 'authenticated'],
        default: 'pending'
    },
    userId: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: () => new Date()
    },
    expiresAt: {
        type: Date,
        required: true
    }
});

// Tự động xóa các token hết hạn
qrLoginSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('QrLogin', qrLoginSchema);