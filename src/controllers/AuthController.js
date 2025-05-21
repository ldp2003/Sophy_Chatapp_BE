require('dotenv').config();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const QrLogin = require('../models/QrLogin');
const cache = require('../utils/cache');
const uuid = require('uuid');
const rateLimit = require('express-rate-limit');
const twilio = require('twilio');
const { v4: uuidv4 } = require('uuid');
const { getSocketController } = require('../socket');
// const SpeedSMS = require('../utils/speedsms');
// const speedsms = new SpeedSMS(process.env.SPEEDSMS_API_KEY);
// const SMSService = require('../utils/tingtingSMS');
// const smsService = new SMSService(
//     process.env.EASYSEND_USERNAME,
//     process.env.EASYSEND_PASSWORD
// );
// const InfobipSMS = require('../utils/infobipSMS');
// const infobipSMS = new InfobipSMS(
//     '21c9830de8d5d2989b34b5c79b417605-82f89bc0-6289-4c1b-a27e-c1e39821e1e7',
//     'd9zz5r.api.infobip.com'
// );


const otpCache = new Map();
const verificationAttempts = new Map();
const qrLoginCache = new Map();

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const checkPhoneLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 5, // tối đa 5 lần request trong 15 phút
    message: { message: 'Request too many verification code, please try again later' },
    keyGenerator: (req) => req.ip // xài IP làm key
})
const phoneVerificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: { message: 'Too many verification attempts, please try again later' },
    keyGenerator: (req) => req.ip
});

const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { message: 'Request too many verification code, please try again later' },
    keyGenerator: (req) => req.ip
})
const forgotPasswordVerificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: { message: 'Too many verification attempts, please try again later' },
    keyGenerator: (req) => req.ip
})

class AuthController {
    constructor() {
        this.checkPhoneLimiter = checkPhoneLimiter;
        this.phoneVerificationLimiter = phoneVerificationLimiter;
        this.forgotPasswordLimiter = forgotPasswordLimiter;
        this.forgotPasswordVerificationLimiter = forgotPasswordVerificationLimiter;
    }

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

            const isValidPassword = await bcrypt.compare(password, user.password);

            if (!isValidPassword) {
                return res.status(401).json({ message: 'Invalid password' });
            }

            const jit = uuid.v4();
            const accessToken = jwt.sign({ userId: user.userId, jit }, process.env.JWT_SECRET, { expiresIn: '1h' });
            const refreshToken = jwt.sign({ userId: user.userId, jit }, process.env.JWT_SECRET, { expiresIn: '7 days' });

            const userAgent = req.headers['user-agent']?.toLowerCase() || '';
            const isBrowser = userAgent.includes('mozilla') && 
                (userAgent.includes('chrome') || 
                userAgent.includes('safari') || 
                userAgent.includes('firefox') || 
                userAgent.includes('edge') ||
                userAgent.includes('opera'));
            console.log('User Agent:', userAgent);
            console.log('Is Browser:', isBrowser);

            if (isBrowser) {
                //check trình duyệt, nếu là td thì  vô hiệu hóa browserToken cũ nếu có
                if (user.deviceTokens.browserToken) {
                    const blacklistKey = `blacklist_${user.userId}_${user.deviceTokens.browserToken}`;
                    cache.set(blacklistKey, { userId: user.userId }, 24 * 60 * 60);
                }
                // update browserToken 
                user.deviceTokens.browserToken = jit;
                user.markModified('deviceTokens');
                await user.save();

                const socketController = getSocketController();
                socketController.emitForceLogout(user.userId, 'browser');
            } else {
                if (!user.deviceTokens.mobileTokens.includes(jit)) {
                    user.deviceTokens.mobileTokens.push(jit);
                    user.markModified('deviceTokens');
                    await user.save();
                }
            }

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

    async checkUsedPhone(req, res) {
        try {
            const { phone, countryCode } = req.params;
            const phoneRegex = /^0\d{9}$/;
            if (!phoneRegex.test(phone)) {
                return res.status(400).json({ message: 'Invalid phone number format.' });
            }

            const user = await User.findOne({ phone });
            if (user) {
                return res.status(400).json({ message: 'Phone number is already used' });
            }

            const otp = Math.floor(100000 + Math.random() * 900000).toString(); // OTP 6 số
            const otpId = uuidv4();

            otpCache.set(phone, {
                otp,
                otpId,
                expiresAt: Date.now() + 5 * 60 * 1000 //5 phút hết hạn
            });

            try {
                console.log(`Testing OTP for ${phone}: ${otp}`);
                return res.json({
                    message: 'Verification code generated.',
                    otpId: otpId,
                    otp: otp
                });
            } catch (smsError) {
                console.error('SMS sending error:', smsError);
                return res.status(500).json({ message: 'Failed to send verification code' });
            }

            // try {
            //     console.log('Twilio Config:', {
            //         accountSid: process.env.TWILIO_ACCOUNT_SID?.substring(0, 5) + '...',
            //         fromNumber: process.env.TWILIO_PHONE_NUMBER,
            //         toNumber: `+84${phone.substring(1)}`
            //     });

            //     const message = await twilioClient.messages.create({
            //         body: `Your verification code to register Sophy is: ${otp}`,
            //         from: process.env.TWILIO_PHONE_NUMBER,
            //         to: `+84${phone.substring(1)}`
            //     });

            //     console.log('Twilio Message SID:', message.sid);

            //     res.json({ 
            //         message: 'Verification code sent to ' + `+84${phone.substring(1)}`,
            //         otpId: otpId
            //     });
            // } catch (smsError) {
            //     console.error('SMS sending error:', smsError);
            //     res.status(500).json({ message: 'Failed to send verification code' });
            // }

            // try{
            //     const user = await speedsms.getUserInfo();
            //     console.log('User Info:', user);
            // } catch (error) {
            //     console.error('Error fetching user info:', error); 
            //     return res.status(500).json({ message: 'Failed to send verification code' });
            // }
            // try {
            //     const message = `Your verification code to register Sophy is: ${otp}`;
            //     const result = await speedsms.sendSMS(phone, message);

            //     if (result.status === 'success') {
            //         res.json({ 
            //             message: 'Verification code sent to ' + `+84${phone.substring(1)}`,
            //             otpId: otpId
            //         });
            //     } else {
            //         throw new Error('SMS sending failed: ' + result.message);
            //     }
            // } catch (smsError) {
            //     console.error('SMS sending error:', smsError);
            //     res.status(500).json({ message: 'Failed to send verification code' });
            // }

            // try {
            //     const message = `Your verification code to register Sophy is: ${otp}`;
            //     await smsService.sendSMS(phone, message);

            //     return res.json({
            //         message: 'Verification code sent to ' + phone,
            //         otpId: otpId
            //     });
            // } catch (smsError) {
            //     console.error('SMS sending error:', smsError);
            //     return res.status(500).json({ message: 'Failed to send verification code' });
            // }

            // try {
            //     const response = await infobipSMS.sendSMS(
            //         '0763934458',
            //         'Your verification code is: 123456',
            //         '447491163443'
            //     );
            //     console.log('SMS sent successfully:', response);
            // } catch (error) {
            //     console.error('Failed to send SMS:', error);
            // }
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async verifyPhoneOTP(req, res) {
        try {
            const { phone, otp, otpId } = req.body;

            const otpData = otpCache.get(phone);

            if (!otpData || otpData.otpId !== otpId) {
                return res.status(400).json({ message: 'Invalid verification attempt' });
            }

            if (Date.now() > otpData.expiresAt) {
                otpCache.delete(phone);
                return res.status(400).json({ message: 'Verification code expired' });
            }

            if (otpData.otp !== otp) {
                const attempts = verificationAttempts.get(phone) || 0;
                verificationAttempts.set(phone, attempts + 1);

                if (attempts >= 3) {
                    otpCache.delete(phone);
                    verificationAttempts.delete(phone);
                    return res.status(400).json({ message: 'Too many failed attempts. Please request a new code.' });
                }

                return res.status(400).json({ message: 'Invalid verification code' });
            }

            otpCache.delete(phone);
            verificationAttempts.delete(phone);

            res.json({ message: 'Phone verified successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async generateQrToken(req, res) {
        try {
            const qrToken = uuidv4();

            await QrLogin.create({
                qrToken,
                status: 'pending',
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 phút
            });

            res.json({
                qrToken: qrToken,
                expiresAt: Date.now() + 5 * 60 * 1000
            });

        } catch (error) {
            console.error('QR token generation error:', error);
            res.status(500).json({ message: error.message });
        }
    }

    async verifyQrToken(req, res) {
        try {
            const { qrToken } = req.body;
            const userId = req.userId;

            // Kiểm tra có tồn tại không
            const tokenData = await QrLogin.findOne({
                qrToken,
                expiresAt: { $gt: new Date() }
            });

            if (!tokenData) {
                return res.status(404).json({ message: 'QR token không tồn tại hoặc đã hết hạn' });
            }

            await QrLogin.updateOne(
                { qrToken },
                {
                    status: 'scanned',
                    userId: userId
                }
            );

            res.json({ message: 'QR token xác thực thành công' });

        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async confirmQrLogin(req, res) {
        try {
            const { qrToken } = req.body;
            const userId = req.userId;

            const tokenData = await QrLogin.findOne({
                qrToken,
                expiresAt: { $gt: new Date() }
            });

            if (!tokenData) {
                return res.status(404).json({ message: 'QR token không tồn tại hoặc đã hết hạn' });
            }

            if (tokenData.status !== 'scanned') {
                return res.status(400).json({ message: 'QR token chưa được quét' });
            }

            if (tokenData.userId !== userId) {
                return res.status(403).json({ message: 'Không có quyền xác nhận QR token này' });
            }


            await QrLogin.updateOne(
                { qrToken },
                {
                    status: 'authenticated',
                    userId: userId
                }
            )

            res.json({ message: 'QR login xác thực thành công' });

        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async checkQrStatus(req, res) {
        try {
            const { qrToken } = req.params;

            const tokenData = await QrLogin.findOne({
                qrToken,
                expiresAt: { $gt: new Date() }
            });

            if (!tokenData) {
                return res.status(404).json({ message: 'QR token không tồn tại hoặc đã hết hạn' });
            }

            // Nếu token đã được xác thực thì làm tạo jwt để xác thực rồi đăng nhập giống login
            if (tokenData.status === 'authenticated') {
                const user = await User.findOne({ userId: tokenData.userId });
                if (!user) {
                    return res.status(404).json({ message: 'Không tìm thấy người dùng' });
                }

                const jit = uuid.v4();
                const accessToken = jwt.sign({ userId: user.userId, jit }, process.env.JWT_SECRET, { expiresIn: '1h' });
                const refreshToken = jwt.sign({ userId: user.userId, jit }, process.env.JWT_SECRET, { expiresIn: '7 days' });

                await QrLogin.deleteOne({ qrToken });

                return res.json({
                    status: tokenData.status,
                    token: {
                        accessToken,
                        refreshToken
                    },
                    user: {
                        userId: user.userId,
                        fullname: user.fullname
                    }
                });
            }

            res.json({
                status: tokenData.status,
                expiresAt: tokenData.expiresAt
            });

        } catch (error) {
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

            const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
            if (!passwordRegex.test(password)) {
                return res.status(400).json({ message: 'Password must be at least 6 characters and contain both letters and numbers' });
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

            try {
                const newUser = await User.create({
                    userId,
                    phone,
                    password: hashedPassword,
                    fullname,
                    isMale: isMale,
                    birthday,
                    settings: {
                        block_msg_from_strangers: false,
                        hidden_profile_from_strangers: true,
                    },
                    friendList: [],
                    createdAt: new Date(),
                    lastActive: new Date()
                });

                if (newUser) {
                    return await this.login(req, res);
                } else {
                    return res.status(500).json({ message: 'Failed to create user' });
                }
            } catch (dbError) {
                console.error('Database error:', dbError);
                return res.status(500).json({ message: 'Failed to create user in database' });
            }
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
            const { oldPassword, newPassword } = req.body;
            const userId = req.userId;
            const user = await User.findOne({ userId: userId });
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: 'Invalid password' });
            }

            const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
            if (!passwordRegex.test(newPassword)) {
                return res.status(400).json({ message: 'Password must be at least 6 characters and contain both letters and numbers' });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await User.findOneAndUpdate({ userId: userId }, { password: hashedPassword, lastActive: new Date() });

            await this.refreshToken(req, res);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async sendOTPForgotPassword(req, res) {
        try {
            const { phone } = req.body;
            const user = await User.findOne({ phone: phone });

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const otpId = uuidv4();

            otpCache.set(phone, {
                otp,
                otpId,
                expiresAt: Date.now() + 5 * 60 * 1000
            });

            try {
                console.log(`Testing OTP for ${phone}: ${otp}`);
                return res.json({
                    message: 'Verification code generated.',
                    otpId: otpId,
                    otp: otp
                });

                // console.log('Twilio Config:', {
                //     accountSid: process.env.TWILIO_ACCOUNT_SID?.substring(0, 5) + '...',
                //     fromNumber: process.env.TWILIO_PHONE_NUMBER,
                //     toNumber: `+84${phone.substring(1)}`
                // });

                // const message = await twilioClient.messages.create({
                //     body: `Your verification code to reset password is: ${otp}`,
                //     from: process.env.TWILIO_PHONE_NUMBER,
                //     to: `+84${phone.substring(1)}`
                // });

                // console.log('Twilio Message SID:', message.sid);

                // res.json({ 
                //     message: 'Verification code sent to ' + `+84${phone.substring(1)}`,
                //     otpId: otpId
                // });
            } catch (smsError) {
                console.error('SMS sending error:', smsError);
                return res.status(500).json({ message: 'Failed to send verification code' });
            }
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async forgotPassword(req, res) {
        try {
            const { phone, newPassword } = req.body;
            const user = await User.findOne({ phone: phone });

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
            if (!passwordRegex.test(newPassword)) {
                return res.status(400).json({ message: 'Password must be at least 6 characters and contain both letters and numbers' });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await User.findOneAndUpdate({ phone: phone }, { password: hashedPassword });

            res.json({ message: 'Password changed successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = AuthController;