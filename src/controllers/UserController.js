const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
const DatauriParser = require('datauri/parser');
const parser = new DatauriParser();

class UserController {
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
            //     await twilioClient.messages.create({
            //         body: `Your verification code to register Sophy is: ${otp}`,
            //         from: process.env.TWILIO_PHONE_NUMBER,
            //         to: phone
            //     });

            //     res.json({ 
            //         message: 'Verification code sent',
            //         otpId: otpId
            //     });
            // } catch (smsError) {
            //     console.error('SMS sending error:', smsError);
            //     res.status(500).json({ message: 'Failed to send verification code' });
            // }
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    async getUserById(req, res) {
        try {
            const { userId } = req.params;
            const user = await User.findOne({ userId }).select('-password');
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            res.json(user);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getUserByPhone(req, res) {
        try {
            const { phone } = req.params;
            const user = await User.findOne({ phone }).select('-password');
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            res.json(user);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async searchUsers(req, res) {
        try {
            const searchParam = req.params.param;

            if (!searchParam) {
                return res.status(400).json({ message: 'Search parameter is required' });
            }

            if (/^\d+$/.test(searchParam)) {
                const users = await User.find({ phone: searchParam }).select('-password -deviceTokens -createdAt -blockList');
                return res.json(users);
            }

            const users = await User.find({
                fullname: { $regex: searchParam, $options: 'i' }
            }).select('-password -deviceTokens -createdAt -blockList');

            res.json(users);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getProfileById(req, res) {
        try {
            const { userId } = req.params;
            const user = await User.findOne({ userId: userId }).select('-password -deviceTokens -createdAt -blockList')
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            res.json(user);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getFriends(req, res) {
        try {
            const userId = req.userId;
            const user = await User.findOne({ userId }).select('-password');

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const friends = await User.find({ userId: { $in: user.listFriend } }).select('-password -deviceTokens -createdAt -blockList');

            res.json(friends);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getBlockedUsers(req, res) {
        try {
            const userId = req.userId;
            const user = await User.findOne({ userId }).select('-password')

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const blockedUsers = await User.find({ userId: { $in: user.blockList } }).select('-password -deviceTokens -createdAt -blockList');

            res.json(blockedUsers);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async updateName(req, res) {
        try {
            const userId = req.userId;
            const { fullname } = req.body;
            const user = await User.findOneAndUpdate({ userId }, { fullname }, { new: true }).select('-password');
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            res.json(user);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async updateAvatar(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'No image file provided' });
            }

            const userId = req.userId;
            const user = await User.findOne({ userId });
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const fileUri = parser.format(
                req.file.originalname,
                req.file.buffer
            ).content;

            // tải avatar mới lên cloud
            const uploadResponse = await cloudinary.uploader.upload(fileUri, {
                folder: 'avatars',
                transformation: [
                    { width: 500, height: 500, crop: 'fill' },
                    { quality: 'auto' }
                ]
            });

            // xóa cái cũ nếu tải oke
            if (user.urlavatar && uploadResponse.secure_url) {
                const publicId = user.urlavatar.split('/').pop().split('.')[0];
                try {
                    await cloudinary.uploader.destroy(`avatars/${publicId}`);
                } catch (deleteError) {
                    console.error('Error deleting old avatar:', deleteError);
                }
            }

            const updatedUser = await User.findOneAndUpdate(
                { userId },
                { urlavatar: uploadResponse.secure_url },
                { new: true }
            ).select('-password');

            res.json({
                message: 'Avatar updated successfully',
                user: updatedUser
            });
        } catch (error) {
            console.error('Avatar update error:', error);
            res.status(500).json({ message: error.message });
        }
    }

    async updateInfo(req, res) {
        try {
            const userId = req.userId;
            const { fullname, gender, birthday } = req.body;
            const user = await User.findOneAndUpdate({ userId }, { fullname, gender, birthday }, { new: true }).select('-password');
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            res.json(user);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async blockUser(req, res) {
        try {
            const userId = req.userId;
            const { blockedUserId } = req.body;
            const user = await User.findOneAndUpdate({ userId }, { $addToSet: { blockList: blockedUserId } }, { new: true }).select('-password');
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            res.json(user);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async unblockUser(req, res) {
        try {
            const userId = req.userId;
            const { blockedUserId } = req.body;
            const user = await User.findOneAndUpdate({ userId }, { $pull: { blockList: blockedUserId } }, { new: true }).select('-password');
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            res.json(user);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }


}

module.exports = UserController;