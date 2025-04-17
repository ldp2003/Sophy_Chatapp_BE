const Notification = require('../models/Notification');
const Conversation = require('../models/Conversation');
const { v4: uuidv4 } = require('uuid');
const { getSocketController } = require('../socket');

class NotificationController {
    async createNotification(type, conversationId, actorId, targetIds, content) {
        try {
            const notification = await Notification.create({
                notificationId: `notif-${conversationId}-${uuidv4()}`,
                type,
                conversationId,
                actorId,
                targetIds,
                createdAt: new Date().toISOString(),
                content
            });

            await Conversation.findOneAndUpdate(
                {
                    conversationId,
                    $or: [
                        { 'lastMessage.createdAt': { $lt: notification.createdAt } },
                        { lastMessage: null }
                    ]
                },
                {
                    newestMessageId: notification.notificationId,
                    lastMessage: {
                        content,
                        type,
                        senderId: null,
                        createdAt: notification.createdAt
                    },
                    lastChange: notification.createdAt
                }
            );

            const socketController = getSocketController();
            socketController.emitNotification(conversationId, notification);

            return notification;
        } catch (error) {
            console.error('Error creating notification:', error);
        }
    }

    async getConversationNotifications(req, res) {
        try {
            const { conversationId } = req.params;
            const { oldestTime, newestTime } = req.query;

            const conversation = await Conversation.findOne({ conversationId });
            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found' });
            }

            const query = { conversationId };

            if (oldestTime || newestTime) {
                query.createdAt = {};
                if (oldestTime) {
                    query.createdAt.$gte = oldestTime;
                }
                if (newestTime) {
                    query.createdAt.$lte = newestTime;
                }
            }

            const notifications = await Notification.find(query)
                .sort({ createdAt: -1 })
                .lean();

            res.json(notifications);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getAllConversationNotifications(req, res) {
        try {
            const { conversationId } = req.params;
            const userId = req.user.userId;
            const conversation = await Conversation.findOne({
                conversationId: conversationId,
                $or: [
                    { creatorId: userId },
                    { receiverId: userId },
                    { groupMembers: { $in: [userId] } }
                ]
            })

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found' });
            }

            const notifications = await Notification.find({ conversationId })
                .sort({ createdAt: -1 })
                .lean();

            res.json(notifications);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = NotificationController;