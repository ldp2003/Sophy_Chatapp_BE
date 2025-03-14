const MessageDetail = require('../models/MessageDetail');
const Conversation = require('../models/Conversation');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');

class MessageDetailController {
    async loadMessageByConversation(req, res) {
        try {
            const { IDConversation } = req.params;
            const { page = 1, limit = 20 } = req.query;
            const userId = req.userId;

            // Check conversation access
            const conversation = await Conversation.findOne({
                IDConversation,
                $or: [
                    { IDCreator: userId },
                    { IDReceiver: userId },
                    { groupMembers: userId }
                ]
            });

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found or access denied' });
            }

            // Get messages with pagination
            const messages = await MessageDetail.find({ IDConversation })
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit);

            // Update read status
            await MessageDetail.updateMany(
                {
                    IDConversation,
                    IDSender: { $ne: userId },
                    'readBy.IDUser': { $ne: userId }
                },
                {
                    $push: {
                        readBy: {
                            IDUser: userId,
                            readAt: new Date().toISOString()
                        }
                    }
                }
            );

            res.json(messages);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async sendMessage(req, res) {
        try {
            const { conversationID, content, type = 'text', attachments = [] } = req.body;
            const senderID = req.userId;

            const conversation = await Conversation.findOne({
                conversationID,
                $or: [
                    { creatorID: senderID },
                    { receiverID: senderID },
                    { groupMembers: senderID }
                ]
            });

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found or access denied' });
            }
        

            if (!conversation.isGroup) {
                const receiver = conversation.creatorID === senderID ? 
                               await User.findById(conversation.receiverID) : 
                               await User.findById(conversation.creatorID);
    
                if (receiver.blockedUsers?.includes(senderID)) {
                    return res.status(403).json({ message: 'You have been blocked by the recipient' });
                }
    
                // Check if sender is a stranger and receiver blocks stranger messages
                const isFriend = await FriendRequest.findOne({
                    $or: [
                        { senderID: senderID, receiverId: receiver.userID, status: 'accepted' },
                        { senderID: receiver.userID, receiverId: senderID, status: 'accepted' }
                    ]
                });
    
                if (!isFriend && receiver.settings?.block_msg_from_strangers) {
                    return res.status(403).json({ message: 'Recipient does not accept messages from non-friends' });
                }
            }

            // Create new message
            const messageDetailID = uuidv4();
            const message = await MessageDetail.create({
                messageDetailID: messageDetailID,
                senderID,
                conversationID,
                type,
                content,
                attachments,
                sendStatus: 'sent'
            });

            // Update conversation's last message
            await Conversation.findByIdAndUpdate(conversationID, {
                newestMessageID: messageDetailID,
                lastMessage: {
                    content,
                    type,
                    senderID,
                    createdAt: message.createdAt
                },
                lastChange: message.createdAt
            });

            res.status(201).json(message);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getMessages(req, res) {
        try {
            const { conversationID } = req.params;
            const { page = 1, limit = 20 } = req.query;
            const userId = req.userId;

            // Check conversation access
            const conversation = await Conversation.findOne({
                conversationID,
                $or: [
                    { creatorID: userId },
                    { receiverID: userId },
                    { groupMembers: userId }
                ]
            });

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found or access denied' });
            }

            // Get messages with pagination
            const messages = await MessageDetail.find({ conversationID })
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit);

            // Update read status
            await MessageDetail.updateMany(
                {
                    conversationID,
                    senderID: { $ne: userId },
                    'readBy.userID': { $ne: userId }
                },
                {
                    $push: {
                        readBy: {
                            userID: userId,
                            readAt: new Date().toISOString()
                        }
                    }
                }
            );

            res.json(messages);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = MessageDetailController;