const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const MessageDetail = require('../models/MessageDetail');
const { v4: uuidv4 } = require('uuid');

class ConversationController {
    async getConversations(req, res) {
        try {
            const userID = req.userId;
            const conversations = await Conversation.find({
                $or: [
                    { creatorID: userID },
                    { receiverID: userID },
                    { groupMembers: userID }
                ]
            }).sort({ lastChange: -1 })
            .populate('lastMessage');

            res.json(conversations);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async createConversation(req, res) {
        try {
            const { receiverID } = req.body;
            const senderID = req.userId;

            // Check if conversation already exists
            const existingConv = await Conversation.findOne({
                $or: [
                    { IDCreator: senderID, IDReceiver: receiverID },
                    { IDCreator: receiverID, IDReceiver: senderID }
                ]
            });

            if (existingConv) {
                return res.json(existingConv);
            }

            const conversation = await Conversation.create({
                conversationID: uuidv4(),
                creatorID: senderID,
                receiverID: receiverID,
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
            const creatorID = req.userId;

            const conversation = await Conversation.create({
                conversationID: uuidv4(),
                creatorID: creatorID,
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