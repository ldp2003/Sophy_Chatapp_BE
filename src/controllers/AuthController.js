const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Token = require('../models/Token');
const cache = require('../utils/cache');
const uuid = require('uuid');

require('dotenv').config();

class AuthController {
    async login(req, res) {
        try {
            const { phone, password } = req.body;

            if (!phone) {
                return res.status(400).json({ message: 'Phone is required' });
            }

            if (!password) {
                return res.status(400).json({ message: 'Password is required' });
            }

            const user = await User.findOne({ phone });

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            console.log('Found user:', user.userId);

            const isValidPassword = await bcrypt.compare(password, user.password);
            console.log('Password valid:', isValidPassword);
            if (!isValidPassword) {
                return res.status(401).json({ message: 'Invalid password' });
            }

            const jit = uuid.v4();
            const accessToken = jwt.sign({ userId: user.userId, jit }, process.env.JWT_SECRET, { expiresIn: '1h' });
            const refreshToken = jwt.sign({ userId: user.userId, jit }, process.env.JWT_SECRET, { expiresIn: '7 days' });

            res.json({
                token: {
                    accessToken,
                    refreshToken
                },
                user: {
                    userId: user.userId,
                    fullname: user.fullname
                }
            });

            await User.findOneAndUpdate({ userId: user.userId }, { lastActive: new Date() });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ message: error.message });
        }
    }

    async register(req, res) {
        try {
            const { phone, password, fullname, isMale, birthday } = req.body;
            console.log('Received data:', { phone, password, fullname, isMale, birthday });
            if (!phone || !password || !fullname || isMale === undefined || !birthday) {
                return res.status(400).json({ message: 'All fields are required' });
            }

            const existingUser = await User.findOne({ $or: [{ phone }] });
            if (existingUser) {
                return res.status(400).json({ message: 'Phone already used' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            
            const last3Digits = phone.slice(-3);
            const birthdayParts = birthday.split('-');
            const formattedBirthday = birthdayParts.length === 3 ?
                `${birthdayParts[0].slice(-2)}${birthdayParts[1]}${birthdayParts[2]}` :
                'unknown';
            const userPattern = `user${last3Digits}${formattedBirthday}`;

            const userId = `${userPattern}`;

            await User.create({
                userId,
                phone,
                password: hashedPassword,
                fullname,
                isMale: isMale,
                birthday,
                settings: {
                    block_msg_from_strangers: false,
                },
                friendList: [],
                createdAt: new Date(),
                lastActive: new Date()
            });

            return await this.login(req, res);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async logout(req, res) {
        try {
            const token = req.header('Authorization').replace('Bearer ', '');
            const blacklistKey = `blacklist_${req.decoded.userId}_${req.decoded.jit}`;
            cache.set(blacklistKey, {
                userId: req.decoded.userId
            }, 24 * 60 * 60); 
            await User.findOneAndUpdate({ userId: req.userId }, { lastActive: new Date() });
            res.json({ message: 'Logged out successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    async refreshToken(req, res) {
        try {
            const token = req.header('Authorization').replace('Bearer ', '');
            const blacklistKey = `blacklist_${req.decoded.userId}_${req.decoded.jit}`;
            cache.set(blacklistKey, {
                userId: req.decoded.userId
            }, 24 * 60 * 60); 

            const user = await User.findOne({ userId: req.userId });
            if (!user) {
                return res.status(404).json({ message: 'User not found' }); 
            }
            const jit = uuid.v4();
            const accessToken = jwt.sign({ userId: user.userId, jit }, process.env.JWT_SECRET, { expiresIn: '1h' });
            const refreshToken = jwt.sign({ userId: user.userId, jit }, process.env.JWT_SECRET, { expiresIn: '7 days' });

            res.json({
                token: {
                    accessToken,
                    refreshToken
                },
                user: {
                    userId: user.userId,
                    fullname: user.fullname
                }
            });

            await User.findOneAndUpdate({ userId: user.userId }, { lastActive: new Date() });
        } 
        catch (error) {
            res.status(500).json({ message: error.message }); 
        }
    }

    async changePassword(req, res) {
        try {
            const {oldPassword, newPassword } = req.body;
            const userId = req.userId;
            const user = await User.findOne({ userId: userId }); 
            if (!user) {
                return res.status(404).json({ message: 'User not found' }); 
            }

            const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: 'Invalid password' });
            }
            
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await User.findOneAndUpdate({ userId: userId }, { password: hashedPassword, lastActive: new Date() });

            await this.refreshToken(req, res);
        } 
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = AuthController;