const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const cloudinary = require('../config/cloudinary');
const DatauriParser = require('datauri/parser');
const parser = new DatauriParser();

class UserController {
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

    async searchUsersByArrayPhone(req, res) {
        try {
            const { phones }= req.body;
            const users = await User.find({ phone: { $in: phones } }).select('-password -deviceTokens -createdAt -blockList');

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

            const friends = await User.find({ userId: { $in: user.friendList } }).select('-password -deviceTokens -createdAt -blockList');

            await User.updateOne(
                { userId: userId },
                { lastActive: new Date() }
            );

            res.json(friends);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async unfriend(req, res) {
        try {
            const userId = req.userId;
            const friendId = req.params.userId;
            const user = await User.findOne({ userId });

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            if (!user.friendList.includes(friendId)) {
                return res.status(400).json({ message: 'User is not your friend' });
            }

            await User.findOneAndUpdate({ userId }, { $pull: { friendList: friendId } }, { new: true });
            await User.findOneAndUpdate({ userId: friendId }, { $pull: { friendList: userId } }, { new: true });

            await FriendRequest.findOneAndDelete({
                $or: [
                    { senderId: userId, receiverId: friendId },
                    { senderId: friendId, receiverId: userId }
                ]
            });

            await User.updateOne(
                { userId: userId },
                { lastActive: new Date() }
            );

            res.json({ message: 'Friend removed successfully' });
        } 
        catch (error) {
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

            await User.updateOne(
                { userId: userId },
                { lastActive: new Date() }
            );
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

            const updatedUser = await User.findOneAndUpdate(
                { userId },
                { urlavatar: uploadResponse.secure_url },
                { new: true }
            ).select('-password');

            //xóa ảnh vừa tải nếu update lỗi
            if (!updatedUser) {
                await cloudinary.uploader.destroy(`avatars/${uploadResponse.public_id}`);
                return res.status(500).json({ message: 'Failed to update user' });
            }

            // xóa cái cũ nếu tải oke
            if (user.urlavatar && uploadResponse.secure_url) {
                const publicId = user.urlavatar.split('/').pop().split('.')[0];
                try {
                    await cloudinary.uploader.destroy(`avatars/${publicId}`);
                } catch (deleteError) {
                    console.error('Error deleting old avatar:', deleteError);
                }
            }

            await User.updateOne(
                { userId: userId },
                { lastActive: new Date() }
            );

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
            const user = await User.findOne({ userId });

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const updateFields = {};
            if (req.body.fullname !== undefined) updateFields.fullname = req.body.fullname;
            if (req.body.isMale !== undefined) updateFields.isMale = req.body.isMale;
            if (req.body.birthday !== undefined) updateFields.birthday = req.body.birthday;
            //không có field nào để update thì bỏ
            if (Object.keys(updateFields).length === 0) {
                return res.status(400).json({ message: 'No fields to update' });
            }

            const updatedUser = await User.findOneAndUpdate(
                { userId }, 
                updateFields, 
                { new: true }
            ).select('-password');

            if (!updatedUser) {
                return res.status(404).json({ message: 'User not found' });
            }

            await User.updateOne(
                { userId: userId },
                { lastActive: new Date() }
            );

            res.json({
                message: 'User info updated successfully',
                user: updatedUser
            });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async updateAvatarMobile(req, res) {
        try {
            const { imageBase64 } = req.body;

            if (!imageBase64) {
                return res.status(400).json({ message: 'No image provided' });
            }

            if (!imageBase64.startsWith('data:image')) {
                return res.status(400).json({ message: 'Invalid image format' });
            }
             
            const userId = req.userId;
            const user = await User.findOne({ userId }); 

            if (!user) {
                return res.status(404).json({ message: 'User not found' }); 
            }

            const uploadResponse = await cloudinary.uploader.upload(imageBase64, {
                folder: 'avatars',
                transformation: [
                    { width: 500, height: 500, crop: 'fill' },
                    { quality: 'auto' }
                ]
            });
            
            const updatedUser = await User.findOneAndUpdate(
                { userId },
                { urlavatar: uploadResponse.secure_url, lastActive: new Date() },
                { new: true }
            ).select('-password');

            //xóa ảnh vừa tải nếu update lỗi
            if (!updatedUser) {
                await cloudinary.uploader.destroy(`avatars/${uploadResponse.public_id}`);
                return res.status(500).json({ message: 'Failed to update user' });
            }

            // xóa cái cũ nếu tải oke
            if (user.urlavatar && uploadResponse.secure_url) {
                const publicId = user.urlavatar.split('/').pop().split('.')[0];
                try {
                    await cloudinary.uploader.destroy(`avatars/${publicId}`);
                } catch (deleteError) {
                    console.error('Error deleting old avatar:', deleteError);
                }
            }

            res.json({
                message: 'Avatar updated successfully',
                user: updatedUser
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async updateInfoMobile(req, res) {
        try {
            const userId = req.userId;
            const { fullname, isMale, birthday } = req.body;
            const user = await User.findOne({ userId });

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const updateFields = {};
            if (fullname !== undefined) updateFields.fullname = fullname;
            if (isMale !== undefined) updateFields.isMale = isMale;
            if (birthday !== undefined) updateFields.birthday = birthday;

            if (Object.keys(updateFields).length === 0) {
                return res.status(400).json({ message: 'No fields to update' });
            }

            const updatedUser = await User.findOneAndUpdate(
                { userId },
                updateFields,
                { new: true }
            ).select('-password');
            
            await User.updateOne(
                { userId: userId },
                { lastActive: new Date() }
            );

            res.json({
                message: 'Profile updated successfully',
                user: updatedUser
            });
        } catch (error) {
            console.error('Update error:', error);
            res.status(500).json({ message: error.message });
        }
    }

    async blockUser(req, res) {
        try {
            const userId = req.userId;
            const blockingUserId = req.params.userId;
            const currentUser = await User.findOne({ userId });
            const blockingUser = await User.findOne({ userId: blockingUserId });
            if (!currentUser) {
                return res.status(404).json({ message: 'Current user not found' });
            }

            if (!blockingUser) {
                return res.status(404).json({ message: 'Blocking user not found' });
            }

            if (currentUser.blockList.includes(blockingUserId)) {
                return res.status(400).json({ message: 'User already blocked' }); 
            }

            if (currentUser.friendList.includes(blockingUserId)) {
                await User.findOneAndUpdate({ userId }, { $pull: { friendList: blockingUserId } }, { new: true });
            }

            if(blockingUser.friendList.includes(userId)) {
                await User.findOneAndUpdate({ userId: blockingUserId }, { $pull: { friendList: userId } }, { new: true }); 
            }
            
            const user = await User.findOneAndUpdate({ userId }, { $addToSet: { blockList: blockingUserId } }, { new: true }).select('-password');
            
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            await User.updateOne(
                { userId: userId },
                { lastActive: new Date() }
            );

            res.json(user);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async unblockUser(req, res) {
        try {
            const userId = req.userId;
            const blockedUserId = req.params.userId;
            const currentUser = await User.findOne({ userId });
            const blockedUser = await User.findOne({ userId: blockedUserId });
            if (!currentUser) {
                return res.status(404).json({ message: 'Current user not found' });
            }

            if (!blockedUser) {
                return res.status(404).json({ message: 'Blocking user not found' });
            }

            if (!currentUser.blockList.includes(blockedUserId)) {
                return res.status(400).json({ message: 'User is not blocked' });  
            }

            const user = await User.findOneAndUpdate({ userId }, { $pull: { blockList: blockedUserId } }, { new: true }).select('-password');
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            await User.updateOne(
                { userId: userId },
                { lastActive: new Date() }
            );

            res.json(user);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = UserController;