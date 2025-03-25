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

            const sender = await User.findOne({userId: senderId});

            const existingConv = await Conversation.findOne({
                $or: [
                    { creatorId: sender.userId, receiverId: receiverId },
                    { creatorId: receiverId, receiverId: sender.userId }
                ]
            });

            if (existingConv) {
                return res.json(existingConv);
            }

            const last3Digits = sender.phone.slice(-3);
            const now = new Date();
            const dateStr = now.getFullYear().toString().slice(-2) +
                          String(now.getMonth() + 1).padStart(2, '0') +
                          String(now.getDate()).padStart(2, '0') +
                          String(now.getHours()).padStart(2, '0') +
                          String(now.getMinutes()).padStart(2, '0') +
                          String(now.getSeconds()).padStart(2, '0');
            const conversationId = `conv${last3Digits}${dateStr}`;
            
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

            const creator = await User.findOne({userId: creatorId});

            const last3Digits = creator.phone.slice(-3);
            const now = new Date();
            const dateStr = now.getFullYear().toString().slice(-2) +
                          String(now.getMonth() + 1).padStart(2, '0') +
                          String(now.getDate()).padStart(2, '0') +
                          String(now.getHours()).padStart(2, '0') +
                          String(now.getMinutes()).padStart(2, '0') +
                          String(now.getSeconds()).padStart(2, '0');
            const conversationId = `conv${last3Digits}${dateStr}`;

            const conversation = await Conversation.create({
                conversationId: conversationId,
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

    async getGroups(req, res) {
        try {
            const userId = req.userId;

            const groups = await Conversation.find({
                $or: [
                    { groupMembers: { $in: [userId] } },
                    { formerMembers: { $in: [userId] } }
                ],
                isGroup: true
            });

            res.json(groups);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getConversationById(req, res) {
        try {
            const conversationId = req.params.conversationId;
            const userId = req.userId;
            
            const conversation = await Conversation.findOne({ conversationId });

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found' });
            }

            if (conversation.isGroup) {
                if (!conversation.groupMembers.includes(userId)) {
                    return res.status(403).json({ message: 'You are not a member of this group' });
                }  
            }

            if (!conversation.isGroup) {
                if (conversation.creatorId !== userId && conversation.receiverId !== userId) {
                    return res.status(403).json({ message: 'You are not a participant in this conversation' });
                }
            }

            res.json(conversation);
        } catch (error) {
            res.status(500).json({ message: error.message }); 
        }
    }
}

module.exports = ConversationController;