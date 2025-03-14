const jwt = require('jsonwebtoken');
const Token = require('../models/Token');

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
        const validToken = await Token.findOne({ token });
        
        if (!validToken) {
            console.log('Token not found in DB');
            throw new Error('Token not found in database');
        }

        req.userID = decoded.userID;
        req.token = token;
        console.log('Authentication successful for user:', req.userID);
        next();
    } catch (error) {
        console.error('Auth error:', error.message);
        res.status(401).json({ message: 'Please authenticate', error: error.message });
    }
};

module.exports = authMiddleware;