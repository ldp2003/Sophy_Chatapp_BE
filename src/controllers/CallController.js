const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { getSocketController } = require('../socket');

class CallController {
    constructor() {
        //constructor
    }
    async initiateCall(req, res) {
        try {
            const { receiverId, type } = req.body; // type: 'audio' or 'video'
            const callerId = req.userId;
            
            const caller = await User.findOne({ userId: callerId });
            const receiver = await User.findOne({ userId: receiverId });

            if (!receiver) {
                return res.status(404).json({ message: 'Receiver not found' });
            }

            const callId = uuidv4();
            const socketController = getSocketController();
            
            // Gửi signal tới người nhận
            socketController.emitIncomingCall({
                callId,
                type,
                caller: {
                    userId: caller.userId,
                    fullname: caller.fullname,
                    avatar: caller.urlavatar
                }
            }, receiverId);

            res.json({ callId });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = CallController;