const FriendRequest = require('../models/FriendRequest');
const User = require('../models/User');

class FriendRequestController {
    async getFriendRequestsSent(req, res) {
        try {
            const userId = req.userId;
            const friendRequests = await FriendRequest.find({ senderId: userId, status: 'pending' })
                .populate({
                    path: 'senderId',
                    select: 'userId fullname urlavatar',
                    model: 'User',
                    localField: 'senderId',
                    foreignField: 'userId'
                });
            res.json(friendRequests);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getFriendRequestsReceived(req, res) {
        try {
            const userId = req.userId;
            const friendRequests = await FriendRequest.find({ receiverId: userId, status: 'pending' })
                .populate({
                    path: 'receiverId',
                    select: 'userId fullname urlavatar',
                    model: 'User',
                    localField: 'receiverId',
                    foreignField: 'userId'
                });
            res.json(friendRequests);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async sendFriendRequest(req, res) {
        try {
            const receiverId = req.params.userId;
            const {message } = req.body;
            const senderId = req.userId;
            const sender = await User.findOne({ userId: senderId });
            if (!sender) {
                return res.status(404).json({ message: 'Sender not found' });
            }
            if (!receiverId) {
                return res.status(400).json({ message: 'Receiver ID is required' });
            }
            const receiver = await User.findOne({ userId: receiverId });
            if (!receiver) {
                return res.status(404).json({ message: 'Receiver not found' });
            }
            if (senderId === receiverId) {
                return res.status(400).json({ message: 'You cannot send a friend request to yourself' });
            }

            const existingPendingRequest = await FriendRequest.findOne({
                $or: [
                    { senderId: senderId, receiverId: receiverId, status: 'pending' },
                    { senderId: receiverId, receiverId: senderId, status: 'pending' }
                ]
            });
            
            if (existingPendingRequest) {
                return res.status(400).json({ message: 'A pending friend request already exists between you and this user' });
            }


            const senderLastThree = sender.phone.slice(-3);
            const receiverLastThree = receiver.phone.slice(-3);
            const currentDate = new Date();
            const dateFormat = currentDate.getFullYear().toString().slice(-2) +
                String(currentDate.getMonth() + 1).padStart(2, '0') +
                String(currentDate.getDate()).padStart(2, '0') +
                String(currentDate.getMinutes()).padStart(2, '0') +
                String(currentDate.getSeconds()).padStart(2, '0');

            const friendRequestId = `fr${senderLastThree}${receiverLastThree}${dateFormat}`;

            const existingRequest = await FriendRequest.findOne({ friendRequestId: friendRequestId });
            if (existingRequest) {
                return res.status(400).json({ message: 'Friend request already sent' });
            }

            if (receiver.friendList.includes(senderId)) {
                return res.status(400).json({ message: 'You are already friends with this user' });
            }
            if (receiver.blockList.includes(senderId)) {
                return res.status(400).json({ message: 'You cannot send a friend request to this user' });
            }
            if (sender.friendList.includes(receiverId)) {
                return res.status(400).json({ message: 'You are already friends with this user' });
            }
            if (sender.blockList.includes(receiverId)) {
                return res.status(400).json({ message: 'You cannot send a friend request to this user' }); 
            }

            await FriendRequest.create({
                friendRequestId: friendRequestId,
                senderId,
                receiverId,
                message,
                status: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            res.json({ message: 'Friend request sent successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async retrieveFriendRequest(req, res) {
        try {
            const requestId = req.params.requestId;
            const userId = req.userId;

            const friendRequest = await FriendRequest.findOne({ friendRequestId: requestId });

            if (!friendRequest) {
                return res.status(404).json({ message: 'Friend request not found' });
            }
            if (friendRequest.senderId !== userId) {
                return res.status(403).json({ message: 'You are not authorized to retrieve this friend request' });
            }
            if (friendRequest.status!=='pending') {
                return res.status(400).json({ message: 'This friend request has already been processed' });
            }
            res.json({message: 'Friend request retrieved successfully'});
        } catch (error) {
            res.status(500).json({ message: error.message }); 
        } 
    }
    async acceptFriendRequest(req, res) {
        try {
            const { friendRequestId } = req.body;
            const userId = req.userId;
            const friendRequest = await FriendRequest.findOne({ friendRequestId });
            if (!friendRequest) {
                return res.status(404).json({ message: 'Friend request not found' });
            } 
            if (friendRequest.receiverId !== userId) {
                return res.status(403).json({ message: 'You are not authorized to accept this friend request' }); 
            }

            const sender = await User.findOne({ userId: friendRequest.senderId });
            if (!sender) {
                return res.status(404).json({ message: 'Sender not found' });
            }

            const receiver = await User.findOne({ userId });
            if (!receiver) {
                return res.status(404).json({ message: 'Receiver not found' });
            }

            if (sender.friendList.includes(receiver.userId)) {
                return res.status(400).json({ message: 'You are already friends with this user' });
            }

            if (sender.blockList.includes(receiver.userId)) {
                return res.status(400).json({ message: 'You cannot add this user to your friend list' });
            }

            if(receiver.friendList.includes(sender.userId)) {
                return res.status(400).json({ message: 'You are already friends with this user' });
            }

            if (receiver.blockList.includes(sender.userId)) {
                return res.status(400).json({ message: 'You cannot add this user to your friend list' });
            }

            sender.friendList.push(receiver.userId);
            receiver.friendList.push(sender.userId);

            await sender.save();
            await receiver.save();

            await FriendRequest.findOneAndUpdate({ friendRequestId }, { status: 'accepted', updatedAt: new Date().toISOString() });

            res.json({ message: 'Friend request accepted successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async rejectFriendRequest(req, res) {
        try {
            const { friendRequestId } = req.body;
            const userId = req.userId;
            const friendRequest = await FriendRequest.findOne({ friendRequestId });
            if (!friendRequest) {
                return res.status(404).json({ message: 'Friend request not found' });
            }

            if (friendRequest.receiverId !== userId) {
                return res.status(403).json({ message: 'You are not authorized to reject this friend request' });  
            } 

            await FriendRequest.findOneAndUpdate({ friendRequestId }, { status: 'rejected', updatedAt: new Date().toISOString() });

            res.json({ message: 'Friend request rejected successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message }); 
        }
    }
}

module.exports = FriendRequestController;