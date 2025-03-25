const FriendRequest = require('../models/FriendRequest');
const User = require('../models/User');

class FriendRequestController {
   async getFriendRequests(req, res) {
        try {
            const userId = req.userId;
            const friendRequests = await FriendRequest.find({ receiverId: userId, status: 'pending' }).populate('senderId', 'userId fullname urlavatar');
            res.json(friendRequests); 
        } 
        catch (error) {
            res.status(500).json({ message: error.message }); 
        }
   }

}

module.exports = FriendRequestController;