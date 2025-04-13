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
            const notifications = await Notification.find({ conversationId })
                .sort({ createdAt: -1 });
            res.json(notifications);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = NotificationController;