const User = require('../models/User');

class UserController {
    async getUserByPhone(req, res) {
        try {
            const { phone } = req.params;
            const user = await User.findOne({ phone });
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
                const users = await User.find({ phone: searchParam }).select('-password');
                return res.json(users);
            }

            const users = await User.find({
                $or: [
                    { fullname: { $regex: searchParam, $options: 'i' } },
                    { username: { $regex: searchParam, $options: 'i' } }
                ]
            }).select('-password');

            res.json(users);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = UserController;