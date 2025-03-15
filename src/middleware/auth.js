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
            userId: decoded.userID
        });

        const validToken = await Token.findOne({ 
            token: token,
            userId: decoded.userID 
        });
        
        console.log('DB search result:', validToken);

        if (!validToken) {
            console.log('Token not found in DB:', {
                providedToken: token,
                decodedUserID: decoded.userID
            });
            throw new Error('Token not found or invalid');
        }

        req.userID = decoded.userID;
        req.token = token;
        console.log('Authentication successful for user:', req.userID);
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