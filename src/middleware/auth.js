const jwt = require('jsonwebtoken');
const Token = require('../models/Token');
const User = require('../models/User');
const cache = require('../utils/cache');
require('dotenv').config();

const authMiddleware = async (req, res, next) => {
    try {
        console.log('=== Auth Middleware Start ===');
        console.log('Headers:', req.headers);
        const token = req.header('Authorization').replace('Bearer ', '');
        console.log('Extracted token:', token);

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.decoded = decoded;
        console.log('Decoded token:', decoded);

        console.log('Searching token in DB with:', {
            token: token,
            userId: decoded.userId
        });

        const user = await User.findOne({ userId: decoded.userId });
        if (!user) {
            console.log('User not found in DB:', decoded.userId);
            throw new Error('User not found');
        }

        req.userId = decoded.userId;
        const jitKey = `blacklist_${req.decoded.userId}_${req.decoded.jit}`;
        getJit = await cache.get(jitKey);
        if (getJit) {
            throw new Error('Token expired');
        }
        console.log('Authentication successful for user:', req.userId);
        next();
    } catch (error) {
        console.error('=== Auth Error ===');
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            type: error.name,
            status: error.status
        });
        res.status(401).json({ message: 'Please authenticate', error: error.message });
    }
};

module.exports = authMiddleware;