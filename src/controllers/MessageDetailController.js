const MessageDetail = require('../models/MessageDetail');
const Conversation = require('../models/Conversation');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');

class MessageDetailController {
    async sendMessage(req, res) {
        try {
            const { conversationId, content, type = 'text', attachments = [] } = req.body;
            const senderId = req.userId;

            const conversation = await Conversation.findOne({
                conversationId,
                $or: [
                    { creatorId: senderId },
                    { receiverId: senderId },
                    { groupMembers: senderId }
                ]
            });

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found or access denied' });
            }


            if (!conversation.isGroup) {
                const receiver = conversation.creatorId === senderId ?
                    await User.findById(conversation.receiverId) :
                    await User.findById(conversation.creatorId);

                if (receiver.blockedUsers?.includes(senderId)) {
                    return res.status(403).json({ message: 'You have been blocked by the recipient' });
                }

                const isFriend = await FriendRequest.findOne({
                    $or: [
                        { senderId: senderId, receiverId: receiver.userId, status: 'accepted' },
                        { senderId: receiver.userId, receiverId: senderId, status: 'accepted' }
                    ]
                });

                if (!isFriend && receiver.settings?.block_msg_from_strangers) {
                    return res.status(403).json({ message: 'Recipient does not accept messages from non-friends' });
                }
            }

            const messageDetailId = uuidv4();
            const message = await MessageDetail.create({
                messageDetailId: messageDetailId,
                senderId,
                conversationId,
                type,
                content,
                attachments,
                sendStatus: 'sent'
            });

            await Conversation.findByIdAndUpdate(conversationId, {
                newestMessageId: messageDetailId,
                lastMessage: {
                    content,
                    type,
                    senderId,
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
            const { conversationId } = req.params;
            const { page = 1, limit = 20 } = req.query;
            const userId = req.userId;

            console.log('Debug:', {
                conversationId,
                userId
            });

            const conversation = await Conversation.find({
                conversationId: conversationId,
                $or: [
                    { creatorId: userId },      
                    { receiverId: userId },     
                    { groupMembers: { $in: [userId] } } 
                ]
            })

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found or access denied' });
            }

            console.log('found:' + conversation);

            const messages = await MessageDetail.find({ conversationId })
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit);

            await MessageDetail.updateMany(
                {
                    conversationId,
                    senderId: { $ne: userId },
                    'readBy.userId': { $ne: userId }
                },
                {
                    $push: {
                        readBy: {
                            userId: userId,
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