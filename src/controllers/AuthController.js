const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Token = require('../models/Token');
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

            console.log('Found user:', user._id);

            const isValidPassword = await bcrypt.compare(password, user.password);
            console.log('Password valid:', isValidPassword);
            if (!isValidPassword) {
                return res.status(401).json({ message: 'Invalid password' });
            }

            const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

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
            if (!phone || !password || !fullname || !isMale || !birthday) {
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
                `${birthdayParts[2]}${birthdayParts[1]}${birthdayParts[0].slice(-2)}` :
                'unknown';
            const userPattern = `user${last3Digits}${formattedBirthday}`;

            const userId = `${userPattern}`;

            await User.create({
                userId,
                phone,
                password: hashedPassword,
                fullname,
                isMale: true,
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
            await Token.findOneAndDelete({ token });
            await User.findOneAndUpdate({ userId: token.userId }, { lastActive: new Date() });
            res.json({ message: 'Logged out successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = AuthController;