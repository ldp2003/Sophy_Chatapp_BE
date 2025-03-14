const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

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

            console.log('Found user:', user.username);
            
            const isValidPassword = await bcrypt.compare(password, user.password);
            console.log('Password valid:', isValidPassword);
            if (!isValidPassword) {
                return res.status(401).json({ message: 'Invalid password' });
            }

            const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
                expiresIn: '24h'
            });

            res.json({ 
                token, 
                user: {
                    id: user._id,
                    username: user.username,
                    fullname: user.fullname
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = AuthController;