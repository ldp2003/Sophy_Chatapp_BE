const MessageDetail = require('../models/MessageDetail');
const Conversation = require('../models/Conversation');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const { getSocketController } = require('../socket');

class MessageDetailController {
    async sendMessage(req, res) {
        try {
            const { conversationId, content, type = 'text', attachments = [] } = req.body;
            const senderId = req.userId;
            const sender = await User.findOne({ userId: senderId });

            if (!sender) {
                return res.status(404).json({ message: 'Sender not found' });
            }

            const conversation = await Conversation.findOne({
                conversationId,
                $or: [
                    { creatorId: sender.userId },
                    { receiverId: sender.userId },
                    { groupMembers: sender.userId }
                ]
            });

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found or access denied' });
            }


            if (!conversation.isGroup) {
                const receiver = conversation.creatorId === sender.userId ?
                    await User.findOne({ userId: conversation.receiverId }) :
                    await User.findOne({ userId: conversation.creatorId });

                if (receiver.blockedUsers?.includes(sender.userId)) {
                    return res.status(403).json({ message: 'You have been blocked by the recipient' });
                }

                const isFriend = await FriendRequest.findOne({
                    $or: [
                        { senderId: sender.userId, receiverId: receiver.userId, status: 'accepted' },
                        { senderId: receiver.userId, receiverId: sender.userId, status: 'accepted' }
                    ]
                });

                if (!isFriend && receiver.settings?.block_msg_from_strangers) {
                    return res.status(403).json({ message: 'Recipient does not accept messages from non-friends' });
                }
            }

            const last3Digits = sender.phone.slice(-3);
            const currentDate = new Date();
            const formattedDate = currentDate.getFullYear().toString().slice(-2) +
                (currentDate.getMonth() + 1).toString().padStart(2, '0') +
                currentDate.getDate().toString().padStart(2, '0') +
                currentDate.getHours().toString().padStart(2, '0') +
                currentDate.getMinutes().toString().padStart(2, '0') +
                currentDate.getSeconds().toString().padStart(2, '0');
            const messageDetailId = `msg${last3Digits}${formattedDate}-${uuidv4()}`;

            const message = await MessageDetail.create({
                messageDetailId: messageDetailId,
                senderId: sender.userId,
                conversationId,
                type,
                content,
                attachments,
                createdAt: new Date().toISOString(),
                sendStatus: 'sent'
            });

            await Conversation.findOneAndUpdate({ conversationId: conversationId }, {
                newestMessageId: messageDetailId,
                lastMessage: {
                    content,
                    type,
                    senderId: sender.userId,
                    createdAt: message.createdAt
                },
                lastChange: message.createdAt
            });

            await User.updateOne(
                { userId: sender.userId },
                { lastActiveTime: new Date() }
            );

            const socketController = getSocketController();
            socketController.emitNewMessage(conversationId, message, {
                userId: sender.userId,
                fullname: sender.fullname,
                avatar: sender.avatar || null
            });
            res.status(201).json(message);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getMessages(req, res) {
        try {
            const { conversationId } = req.params;
            // const { lastMessageTime, limit = 20 } = req.query;
            const { lastMessageTime, direction = 'before', limit = 20 } = req.query;
            const userId = req.userId;

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

            // const query = { conversationId };
            // if (lastMessageTime) {
            //     query.createdAt = { $lt: new Date(lastMessageTime).toISOString() };
            // }
            const query = { conversationId };
            if (lastMessageTime) {
                // Handle both directions of message loading
                query.createdAt = direction === 'before'
                    ? { $lt: lastMessageTime }
                    : { $gt: lastMessageTime };
            }

            // const messages = await MessageDetail.find(query)
            //     .sort({ createdAt: -1 })
            //     .limit(limit)
            //     .lean();
            const messages = await MessageDetail.find(query)
                .sort({ createdAt: direction === 'before' ? -1 : 1 })
                .limit(limit)
                .lean();


            // Lấy timestamp của tin nhắn cuối cùng để dùng cho lần load tiếp theo
            // const nextCursor = messages.length === limit ?
            //     messages[messages.length - 1].createdAt :
            //     null;
            const nextCursor = messages.length === limit
                ? direction === 'before'
                    ? messages[messages.length - 1].createdAt
                    : messages[0].createdAt
                : null;

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

            // res.json({
            //     messages,
            //     nextCursor,
            //     hasMore: !!nextCursor
            // });
            res.json({
                messages: direction === 'before' ? messages : messages.reverse(),
                nextCursor,
                hasMore: !!nextCursor,
                direction
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getMessageContext(req, res) {
        try {
            const { conversationId } = req.params;
            const { messageId, limit = 20 } = req.query;
            const userId = req.userId;

            const conversation = await Conversation.find({
                conversationId,
                $or: [
                    { creatorId: userId },
                    { receiverId: userId },
                    { groupMembers: { $in: [userId] } }
                ]
            });

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found or access denied' });
            }

            const targetMessage = await MessageDetail.findOne({
                messageDetailId: messageId,
                conversationId
            });

            if (!targetMessage) {
                return res.status(404).json({ message: 'Message not found' });
            }

            const halfLimit = Math.floor(limit / 2);

            const beforeMessages = await MessageDetail.find({
                conversationId,
                createdAt: { $lt: targetMessage.createdAt }
            })
                .sort({ createdAt: -1 })
                .limit(halfLimit)
                .lean();

            const afterMessages = await MessageDetail.find({
                conversationId,
                createdAt: { $gt: targetMessage.createdAt }
            })
                .sort({ createdAt: 1 })
                .limit(halfLimit)
                .lean();

            const hasMoreBefore = await MessageDetail.findOne({
                conversationId,
                createdAt: { $lt: beforeMessages[beforeMessages.length - 1]?.createdAt || targetMessage.createdAt }
            });

            const hasMoreAfter = await MessageDetail.findOne({
                conversationId,
                createdAt: { $gt: afterMessages[afterMessages.length - 1]?.createdAt || targetMessage.createdAt }
            });

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

            res.json({
                messages: [...beforeMessages.reverse(), targetMessage, ...afterMessages],
                beforeCursor: beforeMessages.length > 0 ? beforeMessages[beforeMessages.length - 1].createdAt : null,
                afterCursor: afterMessages.length > 0 ? afterMessages[afterMessages.length - 1].createdAt : null,
                hasMoreBefore: !!hasMoreBefore,
                hasMoreAfter: !!hasMoreAfter
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = MessageDetailController;