const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Token = require('../models/Token');
require('dotenv').config();

class AuthController {
    async login(req, res) {
        try {
            const { username, phone, password } = req.body;
            
            if (!username && !phone) {
                return res.status(400).json({ message: 'Username or phone is required' });
            }

            if (!password) {
                return res.status(400).json({ message: 'Password is required' });
            }

            const user = await User.findOne({
                $or: [
                    { username: username },
                    { phone: phone }
                ]
            });
            
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            console.log('Found user:', user.userId);
            
            const isValidPassword = await bcrypt.compare(password, user.password);
            console.log('Password valid:', isValidPassword);
            if (!isValidPassword) {
                return res.status(401).json({ message: 'Invalid password' });
            }

            const token = jwt.sign({ userId:  user._id}, process.env.JWT_SECRET);

            await Token.create({
                userId: user._id,
                token: token
            });

            res.json({ 
                token, 
                user: {
                    id: user._id,
                    userId: user.userId,
                    fullname: user.fullname
                }
            });

            await User.findOneAndUpdate({ userId: user.userId }, { lastActive: new Date () });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ message: error.message });
        }
    }

    async logout(req, res) {
        try {
            const token = req.header('Authorization').replace('Bearer ', '');
            await Token.findOneAndDelete({ token });
            await User.findOneAndUpdate({ userId: token.userId }, { lastActive: new Date () });  
            res.json({ message: 'Logged out successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = AuthController;