const User = require('../models/User');

class UserController {
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
                const users = await User.find({ phone: searchParam }).select('-password -deviceTokens -createdAt -blockList -settings');
                return res.json(users);
            }

            const users = await User.find({
                fullname: { $regex: searchParam, $options: 'i' } 
            }).select('-password -deviceTokens -createdAt -blockList -settings');

            res.json(users);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = UserController;