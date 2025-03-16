const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const MessageDetail = require('../models/MessageDetail');
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

            const existingConv = await Conversation.findOne({
                $or: [
                    { creatorId: senderId, receiverId: receiverId },
                    { creatorId: receiverId, receiverId: senderId }
                ]
            });

            if (existingConv) {
                return res.json(existingConv);
            }

            const conversation = await Conversation.create({
                conversationId: uuidv4(),
                creatorId: senderId,
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