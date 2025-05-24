const jwt = require('jsonwebtoken');
const User = require('../models/User');
const cache = require('../utils/cache');
require('dotenv').config();

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.decoded = decoded;

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
        next();
    } catch (error) {
        res.status(401).json({ message: 'Please authenticate', error: error.message });
    }
};

module.exports = authMiddleware;