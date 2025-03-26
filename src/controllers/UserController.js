const User = require('../models/User');

class UserController {
    async checkUsedPhone(req, res) {
        try {
            const { phone } = req.params;
            const user = await User.findOne({ phone });
            if (user) {
                return res.status(400).json({ message: 'Phone number is already used' });
            }
            res.json({ message: 'Phone number is available' }); 
        } 
        catch (error) {
            res.status(500).json({ message: error.message }); 
        }
    }
    async getUserById(req, res) {
        try {
            const { userId } = req.params;
            const user = await User.findOne({userId}).select('-password');
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
            const {userId} = req.params;
            const user = await User.findOne({userId: userId}).select('-password -deviceTokens -createdAt -blockList')
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
            const user = await User.findOne({userId}).select('-password');

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
            const user = await User.findOne({userId}).select('-password')
            
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
            const userId = req.userId;
            const { urlavatar } = req.body;
            const user = await User.findOneAndUpdate({ userId }, { urlavatar }, { new: true }).select('-password'); 
            if (!user) {
                return res.status(404).json({ message: 'User not found' }); 
            }

            res.json(user);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async updateInfo(req, res) {
        try {
            const userId = req.userId;
            const { fullname, gender, birthday } = req.body;
            const user = await User.findOneAndUpdate({ userId }, { fullname, gender, birthday}, { new: true }).select('-password'); 
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