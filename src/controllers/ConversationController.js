const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const MessageDetail = require('../models/MessageDetail');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');

class ConversationController {
    async getConversations(req, res) {
        try {
            const userId = req.userId;
            console.log('userId: ' + userId);

            const conversations = await Conversation.find({
                $or: [
                    { creatorId: userId },      
                    { receiverId: userId },    
                    { groupMembers: { $in: [userId] } }
                ]
            })
            .sort({ lastChange: -1 })
            .populate('lastMessage');

            console.log('Found conversations:', JSON.stringify(conversations, null, 2));

            res.json(conversations);
        } catch (error) {
            console.error('Error in getConversations:', error);
            res.status(500).json({ message: error.message });
        }
    }

    async createConversation(req, res) {
        try {
            const { receiverId } = req.body;
            const senderId = req.userId;

            const sender = await User.findById(senderId);

            const existingConv = await Conversation.findOne({
                $or: [
                    { creatorId: sender.userId, receiverId: receiverId },
                    { creatorId: receiverId, receiverId: sender.userId }
                ]
            });

            if (existingConv) {
                return res.json(existingConv);
            }

            const lastConversation = await Conversation.findOne({}, {}, { sort: { 'conversationId': -1 } });
            const nextConversationNumber = lastConversation ? parseInt(lastConversation.conversationId.replace('conv', '')) + 1 : 1;
            const conversationId = `conv${nextConversationNumber}`;
            
            const conversation = await Conversation.create({
                conversationId: conversationId,
                creatorId: sender.userId,
                receiverId: receiverId,
                isGroup: false,
                lastChange: new Date(),
                createdAt: new Date()
            });

            res.status(201).json(conversation);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async createGroupConversation(req, res) {
        try {
            const { groupName, groupMembers } = req.body;
            const creatorId = req.userId;

            const conversation = await Conversation.create({
                conversationId: uuidv4(),
                creatorId: creatorId,
                groupName,
                groupMembers,
                isGroup: true,
                lastChange: new Date(),
                createdAt: new Date()
            });

            res.status(201).json(conversation);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = ConversationController;