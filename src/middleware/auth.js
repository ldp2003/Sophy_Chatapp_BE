const jwt = require('jsonwebtoken');
const Token = require('../models/Token');
require('dotenv').config();

const authMiddleware = async (req, res, next) => {
    try {
        console.log('=== Auth Middleware Start ===');
        console.log('Headers:', req.headers);
        const token = req.header('Authorization').replace('Bearer ', '');
        console.log('Extracted token:', token);

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Decoded token:', decoded);

        console.log('Searching token in DB with:', {
            token: token,
            userId: decoded.userId
        });

        const validToken = await Token.findOne({ 
            token: token,
            userId: decoded.userId 
        });
        
        console.log('DB search result:', validToken);

        if (!validToken) {
            console.log('Token not found in DB:', {
                providedToken: token,
                decodedUserId: decoded.userId
            });
            throw new Error('Token not found or invalid');
        }

        req.userId = decoded.userId;
        req.token = token;
        console.log('Authentication successful for user:', req.userId);
        next();
    } catch (error) {
        console.error('=== Auth Error ===');
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            type: error.name
        });
        res.status(401).json({ message: 'Please authenticate', error: error.message });
    }
};

module.exports = authMiddleware;