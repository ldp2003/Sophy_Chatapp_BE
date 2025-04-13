const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true
    },
    otpId: {
        type: String,
        required: true
    },
    otp: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['REGISTER', 'FORGOT_PASSWORD'],
        required: true
    },
    attempts: {
        type: Number,
        default: 0
    },
    expiresAt: {
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Tự động xóa token hết hạn
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Token', tokenSchema);