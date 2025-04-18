const MessageDetail = require('../models/MessageDetail');
const Conversation = require('../models/Conversation');
const NotificationController = require('./NotificationController');
const notificationController = new NotificationController();
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const cloudinary = require('../config/cloudinary');
const DatauriParser = require('datauri/parser');
const parser = new DatauriParser();
const { getSocketController } = require('../socket');

class MessageDetailController {
    async sendMessage(req, res) {
        try {
            const { conversationId, content, type = 'text' } = req.body;
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

                if (receiver.blockList?.includes(sender.userId)) {
                    return res.status(403).json({ message: 'You have been blocked by the recipient' });
                }

                if (sender.blockList?.includes(receiver.userId)) {
                    return res.status(403).json({ message: 'You have blocked the recipient' });
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
                createdAt: new Date().toISOString(),
                sendStatus: 'sent'
            });

            const updateData = {
                newestMessageId: messageDetailId,
                lastMessage: {
                    content,
                    type,
                    senderId: sender.userId,
                    createdAt: message.createdAt
                },
                lastChange: message.createdAt
            };

            if (conversation.isGroup) {
                // First find existing unreadCount for each member
                const existingUnreadCounts = conversation.unreadCount || [];
                const updatedUnreadCounts = conversation.groupMembers.map(memberId => {
                    const existing = existingUnreadCounts.find(u => u.userId === memberId);
                    return {
                        userId: memberId,
                        count: memberId === sender.userId ? 0 : ((existing?.count || 0) + 1),
                        lastReadMessageId: memberId === sender.userId ? messageDetailId : (existing?.lastReadMessageId || null)
                    };
                });

                await Conversation.findOneAndUpdate(
                    { conversationId },
                    {
                        ...updateData,
                        $set: { unreadCount: updatedUnreadCounts }
                    }
                );
            } else {
                const receiverId = conversation.creatorId === sender.userId ?
                    conversation.receiverId : conversation.creatorId;

                const existingUnreadCounts = conversation.unreadCount || [];
                const updatedUnreadCounts = [
                    {
                        userId: sender.userId,
                        count: 0,
                        lastReadMessageId: messageDetailId
                    },
                    {
                        userId: receiverId,
                        count: (existingUnreadCounts.find(u => u.userId === receiverId)?.count || 0) + 1,
                        lastReadMessageId: existingUnreadCounts.find(u => u.userId === receiverId)?.lastReadMessageId || null
                    }
                ];

                await Conversation.findOneAndUpdate(
                    { conversationId },
                    {
                        ...updateData,
                        $set: { unreadCount: updatedUnreadCounts }
                    }
                );
            }

            await User.updateOne(
                { userId: sender.userId },
                { lastActive: new Date() }
            );

            const socketController = getSocketController();
            socketController.emitNewMessage(conversationId, {
                ...message,
                messageId: message.messageDetailId
            }, {
                userId: sender.userId,
                fullname: sender.fullname,
                avatar: sender.urlavatar || null
            });

            res.status(201).json(message);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    async sendMessageWithImage(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded' });
            }

            const { conversationId, content, type = 'text-with-image' } = req.body;
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

                if (receiver.blockList?.includes(sender.userId)) {
                    return res.status(403).json({ message: 'You have been blocked by the recipient' });
                }

                if (sender.blockList?.includes(receiver.userId)) {
                    return res.status(403).json({ message: 'You have blocked the recipient' });
                }

                const isFriend = await FriendRequest.findOne({
                    $or: [
                        { senderId: sender.userId, receiverId: receiver.userId, status: 'accepted' },
                        { senderId: receiver.userId, receiverId: sender.userId, status: 'accepted' }
                    ]
                })

                if (!isFriend && receiver.settings?.block_msg_from_strangers) {
                    return res.status(403).json({ message: 'Recipient does not accept messages from non-friends' });
                }
            }

            const fileUri = parser.format(
                req.file.originalname,
                req.file.buffer
            ).content;

            const uploadResponse = await cloudinary.uploader.upload(fileUri, {
                folder: `conversations/${conversationId}/images`,
                transformation: [
                    { quality: 'auto' },
                    { fetch_format: 'auto' }
                ],
                flags: 'attachment'
            });

            const last3Digits = sender.phone.slice(-3);
            const currentDate = new Date();
            const formattedDate = currentDate.getFullYear().toString().slice(-2) +
                (currentDate.getMonth() + 1).toString().padStart(2, '0') +
                currentDate.getDate().toString().padStart(2, '0') +
                currentDate.getHours().toString().padStart(2, '0') +
                currentDate.getMinutes().toString().padStart(2, '0') +
                currentDate.getSeconds().toString().padStart(2, '0');
            const messageDetailId = `msg${last3Digits}${formattedDate}-${uuidv4()}`;

            const attachment = {
                type: 'image',
                url: uploadResponse.secure_url,
                downloadUrl: uploadResponse.secure_url.replace('/upload/', '/upload/fl_attachment/'),
                name: req.file.originalname,
                size: uploadResponse.bytes,
            };

            const message = await MessageDetail.create({
                messageDetailId: messageDetailId,
                senderId: sender.userId,
                conversationId,
                type,
                content,
                attachment: attachment,
                createdAt: new Date().toISOString(),
                sendStatus: 'sent'
            });

            await Conversation.findOneAndUpdate({ conversationId: conversationId }, {
                $push: {
                    listImage:{
                        url: attachment.url,
                        downloadUrl: attachment.downloadUrl
                    }
                }
            })
            
            const updateData = {
                newestMessageId: messageDetailId,
                lastMessage: {
                    content,
                    type,
                    senderId: sender.userId,
                    createdAt: message.createdAt
                },
                lastChange: message.createdAt
            };

            if (conversation.isGroup) {
                // First find existing unreadCount for each member
                const existingUnreadCounts = conversation.unreadCount || [];
                const updatedUnreadCounts = conversation.groupMembers.map(memberId => {
                    const existing = existingUnreadCounts.find(u => u.userId === memberId);
                    return {
                        userId: memberId,
                        count: memberId === sender.userId ? 0 : ((existing?.count || 0) + 1),
                        lastReadMessageId: memberId === sender.userId ? messageDetailId : (existing?.lastReadMessageId || null)
                    };
                });

                await Conversation.findOneAndUpdate(
                    { conversationId },
                    {
                        ...updateData,
                        $set: { unreadCount: updatedUnreadCounts }
                    }
                );
            } else {
                const receiverId = conversation.creatorId === sender.userId ?
                    conversation.receiverId : conversation.creatorId;

                const existingUnreadCounts = conversation.unreadCount || [];
                const updatedUnreadCounts = [
                    {
                        userId: sender.userId,
                        count: 0,
                        lastReadMessageId: messageDetailId
                    },
                    {
                        userId: receiverId,
                        count: (existingUnreadCounts.find(u => u.userId === receiverId)?.count || 0) + 1,
                        lastReadMessageId: existingUnreadCounts.find(u => u.userId === receiverId)?.lastReadMessageId || null
                    }
                ];

                await Conversation.findOneAndUpdate(
                    { conversationId },
                    {
                        ...updateData,
                        $set: { unreadCount: updatedUnreadCounts }
                    }
                );
            }

            await User.updateOne(
                { userId: sender.userId },
                { lastActive: new Date() }
            )

            const socketController = getSocketController();
            socketController.emitNewMessage(conversationId, {
                ...message,
                messageId: message.messageDetailId
            }, {
                userId: sender.userId,
                fullname: sender.fullname,
                avatar: sender.urlavatar || null
            });

            res.status(201).json(message);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async sendMessageOnlyImage(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded' });
            }

            const { conversationId } = req.body;
            const type = 'image';

            const userId = req.userId;
            const sender = await User.findOne({ userId: userId });

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

                if (receiver.blockList?.includes(sender.userId)) {
                    return res.status(403).json({ message: 'You have been blocked by the recipient' });
                }

                if (sender.blockList?.includes(receiver.userId)) {
                    return res.status(403).json({ message: 'You have blocked the recipient' });
                }

                const isFriend = await FriendRequest.findOne({
                    $or: [
                        { senderId: sender.userId, receiverId: receiver.userId, status: 'accepted' },
                        { senderId: receiver.userId, receiverId: sender.userId, status: 'accepted' }
                    ]
                })

                if (!isFriend && receiver.settings?.block_msg_from_strangers) {
                    return res.status(403).json({ message: 'Recipient does not accept messages from non-friends' });
                }
            }

            const fileUri = parser.format(
                req.file.originalname,
                req.file.buffer
            ).content;

            const uploadResponse = await cloudinary.uploader.upload(fileUri, {
                folder: `conversations/${conversationId}/${type}s`,
                transformation: [
                    { quality: 'auto' },
                    { fetch_format: 'auto' }
                ],
                flags: 'attachment'
            })

            const attachment = {
                url: uploadResponse.secure_url,
                downloadUrl: uploadResponse.secure_url.replace('/upload/', '/upload/fl_attachment/'),
                type: type,
                name: req.file.originalname,
                size: uploadResponse.bytes,

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
                content: null,
                attachment,
                createdAt: new Date().toISOString(),
                sendStatus: 'sent'
            });

            await Conversation.findOneAndUpdate({ conversationId: conversationId }, {
                $push: {
                    listImage: {
                        url: attachment.url,
                        downloadUrl: attachment.downloadUrl
                    }
                }
            })

            const updateData = {
                newestMessageId: messageDetailId,
                lastMessage: {
                    content: attachment.name,
                    type,
                    senderId: sender.userId,
                    createdAt: message.createdAt
                },
                lastChange: message.createdAt
            };


            if (conversation.isGroup) {
                // First find existing unreadCount for each member
                const existingUnreadCounts = conversation.unreadCount || [];
                const updatedUnreadCounts = conversation.groupMembers.map(memberId => {
                    const existing = existingUnreadCounts.find(u => u.userId === memberId);
                    return {
                        userId: memberId,
                        count: memberId === sender.userId ? 0 : ((existing?.count || 0) + 1),
                        lastReadMessageId: memberId === sender.userId ? messageDetailId : (existing?.lastReadMessageId || null)
                    };
                });

                await Conversation.findOneAndUpdate(
                    { conversationId },
                    {
                        ...updateData,
                        $set: { unreadCount: updatedUnreadCounts }
                    }
                );
            } else {
                const receiverId = conversation.creatorId === sender.userId ?
                    conversation.receiverId : conversation.creatorId;

                const existingUnreadCounts = conversation.unreadCount || [];
                const updatedUnreadCounts = [
                    {
                        userId: sender.userId,
                        count: 0,
                        lastReadMessageId: messageDetailId
                    },
                    {
                        userId: receiverId,
                        count: (existingUnreadCounts.find(u => u.userId === receiverId)?.count || 0) + 1,
                        lastReadMessageId: existingUnreadCounts.find(u => u.userId === receiverId)?.lastReadMessageId || null
                    }
                ];

                await Conversation.findOneAndUpdate(
                    { conversationId },
                    {
                        ...updateData,
                        $set: { unreadCount: updatedUnreadCounts }
                    }
                );
            }

            await User.updateOne(
                { userId: sender.userId },
                { lastActive: new Date() }
            )

            const socketController = getSocketController();
            socketController.emitNewMessage(conversationId, {
                ...message,
                messageId: message.messageDetailId
            }, {
                userId: sender.userId,
                fullname: sender.fullname,
                avatar: sender.urlavatar || null
            });

            res.status(201).json(message);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async sendMessageOnlyFile(req, res) {
        try {
            const { conversationId, attachment } = req.body;
            const userId = req.userId;
            const sender = await User.findOne({ userId: userId });
            const conversation = await Conversation.findOne({
                conversationId,
                $or: [
                    { creatorId: sender.userId },
                    { receiverId: sender.userId },
                    { groupMembers: sender.userId }
                ]
            });

            if (!sender) {
                return res.status(404).json({ message: 'Sender not found' });
            }

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found or access denied' });
            }

            if (!conversation.isGroup) {
                const receiver = conversation.creatorId === sender.userId ?
                    await User.findOne({ userId: conversation.receiverId }) :
                    await User.findOne({ userId: conversation.creatorId });

                if (receiver.blockList?.includes(sender.userId)) {
                    return res.status(403).json({ message: 'You have been blocked by the recipient' });
                }

                if (sender.blockList?.includes(receiver.userId)) {
                    return res.status(403).json({ message: 'You have blocked the recipient' });
                }

                const isFriend = await FriendRequest.findOne({
                    $or: [
                        { senderId: sender.userId, receiverId: receiver.userId, status: 'accepted' },
                        { senderId: receiver.userId, receiverId: sender.userId, status: 'accepted' }
                    ]
                })

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
                type: attachment.type,
                content: null,
                attachment: attachment,
                createdAt: new Date().toISOString(),
                sendStatus: 'sent'
            });

            await Conversation.findOneAndUpdate({ conversationId: conversationId }, {
                $push: {
                    listFile: {
                        name: attachment.name,
                        downloadUrl: attachment.downloadUrl
                    }
                }
            });

            const updateData = {
                newestMessageId: messageDetailId,
                lastMessage: {
                    content: attachment.name,
                    type: attachment.type,
                    senderId: sender.userId,
                    createdAt: message.createdAt
                },
                lastChange: message.createdAt
            };

            if (conversation.isGroup) {
                // First find existing unreadCount for each member
                const existingUnreadCounts = conversation.unreadCount || [];
                const updatedUnreadCounts = conversation.groupMembers.map(memberId => {
                    const existing = existingUnreadCounts.find(u => u.userId === memberId);
                    return {
                        userId: memberId,
                        count: memberId === sender.userId ? 0 : ((existing?.count || 0) + 1),
                        lastReadMessageId: memberId === sender.userId ? messageDetailId : (existing?.lastReadMessageId || null)
                    };
                });

                await Conversation.findOneAndUpdate(
                    { conversationId },
                    {
                        ...updateData,
                        $set: { unreadCount: updatedUnreadCounts }
                    }
                );
            } else {
                const receiverId = conversation.creatorId === sender.userId ?
                    conversation.receiverId : conversation.creatorId;

                const existingUnreadCounts = conversation.unreadCount || [];
                const updatedUnreadCounts = [
                    {
                        userId: sender.userId,
                        count: 0,
                        lastReadMessageId: messageDetailId
                    },
                    {
                        userId: receiverId,
                        count: (existingUnreadCounts.find(u => u.userId === receiverId)?.count || 0) + 1,
                        lastReadMessageId: existingUnreadCounts.find(u => u.userId === receiverId)?.lastReadMessageId || null
                    }
                ];

                await Conversation.findOneAndUpdate(
                    { conversationId },
                    {
                        ...updateData,
                        $set: { unreadCount: updatedUnreadCounts }
                    }
                );
            }

            await User.updateOne(
                { userId: sender.userId },
                { lastActive: new Date() }
            )

            const socketController = getSocketController();
            socketController.emitNewMessage(conversationId, {
                ...message,
                messageId: message.messageDetailId
            }, {
                userId: sender.userId,
                fullname: sender.fullname,
                avatar: sender.urlavatar || null
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
            const user = await User.findOne({ userId: userId });

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const conversation = await Conversation.findOne({
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
                ? messages[messages.length - 1].createdAt
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

            await Conversation.updateOne(
                { conversationId },
                {
                    $set: {
                        'unreadCount.$[elem].lastReadMessageId': conversation.newestMessageId,
                        'unreadCount.$[elem].count': 0
                    }
                },
                {
                    arrayFilters: [{ 'elem.userId': userId }]
                }
            );

            await User.updateOne(
                { userId: userId },
                { lastActive: new Date() }
            );

            const socketController = getSocketController();
            socketController.emitReadMessage(conversationId, {
                userId: userId,
                fullname: user.fullname,
                avatar: user.urlavatar || null
            });

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

    async getAllMessages(req, res) {
        try {
            const conversationId = req.params.conversationId;
            const userId = req.userId;

            const conversation = await Conversation.findOne({
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

            const messages = await MessageDetail.find({ conversationId: conversationId }).sort({ createdAt: -1 });

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

            await Conversation.updateOne(
                { conversationId },
                {
                    $set: {
                        'unreadCount.$[elem].lastReadMessageId': conversation.newestMessageId,
                        'unreadCount.$[elem].count': 0
                    }
                },
                {
                    arrayFilters: [{ 'elem.userId': userId }]
                }
            );

            await User.updateOne(
                { userId: userId },
                { lastActive: new Date() }
            );
            res.json(messages);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async sendMessageWithImageMobile(req, res) {
        try {
            const { imageBase64, content, conversationId } = req.body;

            const userId = req.userId;
            const sender = await User.findOne({ userId: userId });
            const conversation = await Conversation.findOne({
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

            if (!conversation.isGroup) {
                const receiver = conversation.creatorId === sender.userId ?
                    await User.findOne({ userId: conversation.receiverId }) :
                    await User.findOne({ userId: conversation.creatorId });

                if (receiver.blockList?.includes(sender.userId)) {
                    return res.status(403).json({ message: 'You have been blocked by the recipient' });
                }

                if (sender.blockList?.includes(receiver.userId)) {
                    return res.status(403).json({ message: 'You have blocked the recipient' });
                }

                const isFriend = await FriendRequest.findOne({
                    $or: [
                        { senderId: sender.userId, receiverId: receiver.userId, status: 'accepted' },
                        { senderId: receiver.userId, receiverId: sender.userId, status: 'accepted' }
                    ]
                })

                if (!isFriend && receiver.settings?.block_msg_from_strangers) {
                    return res.status(403).json({ message: 'Recipient does not accept messages from non-friends' });
                }
            }

            if (!sender) {
                return res.status(404).json({ message: 'Sender not found' });
            }

            if (!imageBase64) {
                return res.status(400).json({ message: 'No image provided' });
            }

            if (!imageBase64.startsWith('data:image')) {
                return res.status(400).json({ message: 'Invalid image format' });
            }

            const uploadResponse = await cloudinary.uploader.upload(imageBase64, {
                folder: `conversations/${conversationId}/images`,
                transformation: [
                    { quality: 'auto' },
                    { fetch_format: 'auto' }
                ],
                flags: 'attachment'
            });

            const attachment = {
                url: uploadResponse.secure_url,
                downloadUrl: uploadResponse.secure_url.replace('/upload/', '/upload/fl_attachment/'),
                type: 'image',
                name: imageBase64.split(',')[1],
                size: uploadResponse.bytes,
            };

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
                type: 'text-with-image',
                content,
                attachment,
                createdAt: new Date().toISOString(),
                sendStatus: 'sent'
            });

            await Conversation.findOneAndUpdate({ conversationId: conversationId }, {
                $push: {
                    listImage: {
                        url: attachment.url,
                        downloadUrl: attachment.downloadUrl,
                    }
                },
            })

            const updateData = {
                newestMessageId: messageDetailId,
                lastMessage: {
                    content,
                    type,
                    senderId: sender.userId,
                    createdAt: message.createdAt
                },
                lastChange: message.createdAt
            };

            if (conversation.isGroup) {
                // First find existing unreadCount for each member
                const existingUnreadCounts = conversation.unreadCount || [];
                const updatedUnreadCounts = conversation.groupMembers.map(memberId => {
                    const existing = existingUnreadCounts.find(u => u.userId === memberId);
                    return {
                        userId: memberId,
                        count: memberId === sender.userId ? 0 : ((existing?.count || 0) + 1),
                        lastReadMessageId: memberId === sender.userId ? messageDetailId : (existing?.lastReadMessageId || null)
                    };
                });

                await Conversation.findOneAndUpdate(
                    { conversationId },
                    {
                        ...updateData,
                        $set: { unreadCount: updatedUnreadCounts }
                    }
                );
            } else {
                const receiverId = conversation.creatorId === sender.userId ?
                    conversation.receiverId : conversation.creatorId;

                const existingUnreadCounts = conversation.unreadCount || [];
                const updatedUnreadCounts = [
                    {
                        userId: sender.userId,
                        count: 0,
                        lastReadMessageId: messageDetailId
                    },
                    {
                        userId: receiverId,
                        count: (existingUnreadCounts.find(u => u.userId === receiverId)?.count || 0) + 1,
                        lastReadMessageId: existingUnreadCounts.find(u => u.userId === receiverId)?.lastReadMessageId || null
                    }
                ];

                await Conversation.findOneAndUpdate(
                    { conversationId },
                    {
                        ...updateData,
                        $set: { unreadCount: updatedUnreadCounts }
                    }
                );
            }
            await User.updateOne(
                { userId: sender.userId },
                { lastActive: new Date() }
            )

            const socketController = getSocketController();
            socketController.emitNewMessage(conversationId, {
                ...message,
                messageId: message.messageDetailId
            }, {
                userId: sender.userId,
                fullname: sender.fullname,
                avatar: sender.urlavatar || null
            });

            res.status(201).json(message);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async sendMessageOnlyImageMobile(req, res) {
        try {
            const { imageBase64, conversationId } = req.body;
            const userId = req.userId;
            const sender = await User.findOne({ userId: userId });
            const conversation = await Conversation.findOne({
                conversationId: conversationId,
                $or: [
                    { creatorId: userId },
                    { receiverId: userId },
                    { groupMembers: { $in: [userId] } }
                ]
            })

            if (!sender) {
                return res.status(404).json({ message: 'Sender not found' });
            }

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found or access denied' });
            }

            if (!conversation.isGroup) {
                const receiver = conversation.creatorId === sender.userId ?
                    await User.findOne({ userId: conversation.receiverId }) :
                    await User.findOne({ userId: conversation.creatorId });

                if (receiver.blockList?.includes(sender.userId)) {
                    return res.status(403).json({ message: 'You have been blocked by the recipient' });
                }

                if (sender.blockList?.includes(receiver.userId)) {
                    return res.status(403).json({ message: 'You have blocked the recipient' });
                }

                const isFriend = await FriendRequest.findOne({
                    $or: [
                        { senderId: sender.userId, receiverId: receiver.userId, status: 'accepted' },
                        { senderId: receiver.userId, receiverId: sender.userId, status: 'accepted' }
                    ]
                })

                if (!isFriend && receiver.settings?.block_msg_from_strangers) {
                    return res.status(403).json({ message: 'Recipient does not accept messages from non-friends' });
                }
            }

            if (!imageBase64) {
                return res.status(400).json({ message: 'No image provided' });
            }

            if (!imageBase64.startsWith('data:image')) {
                return res.status(400).json({ message: 'Invalid image format' });
            }

            const uploadResponse = await cloudinary.uploader.upload(imageBase64, {
                folder: `conversations/${conversationId}/images`,
                transformation: [
                    { quality: 'auto' },
                    { fetch_format: 'auto' }
                ],
                flags: 'attachment'
            })

            const attachment = {
                url: uploadResponse.secure_url,
                downloadUrl: uploadResponse.secure_url.replace('/upload/', '/upload/fl_attachment/'),
                type: 'image',
                name: imageBase64.split(',')[1],
                size: uploadResponse.bytes,
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
                type: 'image',
                content: null,
                attachment,
                createdAt: new Date().toISOString(),
                sendStatus: 'sent'
            });

            await Conversation.findOneAndUpdate({ conversationId: conversationId }, {
                $push: {
                    listImage: {
                        url: attachment.url,
                        downloadUrl: attachment.downloadUrl,
                    }
                }
            })

            const updateData = {
                newestMessageId: messageDetailId,
                lastMessage: {
                    content: attachment.name,
                    type: attachment.type,
                    senderId: sender.userId,
                    createdAt: message.createdAt
                },
                lastChange: message.createdAt
            };


            if (conversation.isGroup) {
                // First find existing unreadCount for each member
                const existingUnreadCounts = conversation.unreadCount || [];
                const updatedUnreadCounts = conversation.groupMembers.map(memberId => {
                    const existing = existingUnreadCounts.find(u => u.userId === memberId);
                    return {
                        userId: memberId,
                        count: memberId === sender.userId ? 0 : ((existing?.count || 0) + 1),
                        lastReadMessageId: memberId === sender.userId ? messageDetailId : (existing?.lastReadMessageId || null)
                    };
                });

                await Conversation.findOneAndUpdate(
                    { conversationId },
                    {
                        ...updateData,
                        $set: { unreadCount: updatedUnreadCounts }
                    }
                );
            } else {
                const receiverId = conversation.creatorId === sender.userId ?
                    conversation.receiverId : conversation.creatorId;

                const existingUnreadCounts = conversation.unreadCount || [];
                const updatedUnreadCounts = [
                    {
                        userId: sender.userId,
                        count: 0,
                        lastReadMessageId: messageDetailId
                    },
                    {
                        userId: receiverId,
                        count: (existingUnreadCounts.find(u => u.userId === receiverId)?.count || 0) + 1,
                        lastReadMessageId: existingUnreadCounts.find(u => u.userId === receiverId)?.lastReadMessageId || null
                    }
                ];

                await Conversation.findOneAndUpdate(
                    { conversationId },
                    {
                        ...updateData,
                        $set: { unreadCount: updatedUnreadCounts }
                    }
                );
            }

            await User.updateOne(
                { userId: sender.userId },
                { lastActive: new Date() }
            )

            const socketController = getSocketController();
            socketController.emitNewMessage(conversationId, {
                ...message,
                messageId: message.messageDetailId
            }, {
                userId: sender.userId,
                fullname: sender.fullname,
                avatar: sender.urlavatar || null
            });

            res.status(201).json(message);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async sendMessageOnlyFileMobile(req, res) {
        try {
            const { fileBase64, conversationId, fileName, fileType } = req.body;
            const userId = req.userId;
            const sender = await User.findOne({ userId: userId });
            const conversation = await Conversation.findOne({
                conversationId: conversationId,
                $or: [
                    { creatorId: userId },
                    { receiverId: userId },
                    { groupMembers: { $in: [userId] } }
                ]
            });

            if (!sender) {
                return res.status(404).json({ message: 'Sender not found' });
            }

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found or access denied' });
            }

            if (!conversation.isGroup) {
                const receiver = conversation.creatorId === sender.userId ?
                    await User.findOne({ userId: conversation.receiverId }) :
                    await User.findOne({ userId: conversation.creatorId });

                if (receiver.blockList?.includes(sender.userId)) {
                    return res.status(403).json({ message: 'You have been blocked by the recipient' });
                }

                if (sender.blockList?.includes(receiver.userId)) {
                    return res.status(403).json({ message: 'You have blocked the recipient' });
                }

                const isFriend = await FriendRequest.findOne({
                    $or: [
                        { senderId: sender.userId, receiverId: receiver.userId, status: 'accepted' },
                        { senderId: receiver.userId, receiverId: sender.userId, status: 'accepted' }
                    ]
                })

                if (!isFriend && receiver.settings?.block_msg_from_strangers) {
                    return res.status(403).json({ message: 'Recipient does not accept messages from non-friends' });
                }
            }

            if (!fileBase64) {
                return res.status(400).json({ message: 'No file provided' });
            }

            if (!fileBase64.startsWith('data:')) {
                return res.status(400).json({ message: 'Invalid file format' });
            }

            const mimeType = fileBase64.split(';')[0].split(':')[1];
            const type = mimeType.startsWith('video/') ? 'video' : 'file';

            const uploadOptions = {
                folder: `conversations/${conversationId}/${type}s`,
                resource_type: 'auto',
                flags: 'attachment'
            };

            if (type === 'video') {
                uploadOptions.eager = [
                    { format: 'mp4', quality: 'auto' }
                ];
                uploadOptions.chunk_size = 6000000;
            }

            const uploadResponse = await cloudinary.uploader.upload(fileBase64, uploadOptions);

            const attachment = {
                url: uploadResponse.secure_url,
                downloadUrl: uploadResponse.secure_url.replace('/upload/', '/upload/fl_attachment/'),
                type: fileType,
                name: fileName,
                size: uploadResponse.bytes,
            };


            if (type === 'video') {
                attachment.duration = uploadResponse.duration;
                attachment.thumbnail = uploadResponse.thumbnail_url;
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
                content: null,
                attachment,
                createdAt: new Date().toISOString(),
                sendStatus: 'sent'
            });

            await Conversation.findOneAndUpdate({ conversationId: conversationId }, {
                $push: {
                    listFile: {
                        name: attachment.name,
                        downloadUrl: attachment.downloadUrl
                    }
                }
            });

            const updateData = {
                newestMessageId: messageDetailId,
                lastMessage: {
                    content: attachment.name,
                    type: attachment.type,
                    senderId: sender.userId,
                    createdAt: message.createdAt
                },
                lastChange: message.createdAt
            };


            if (conversation.isGroup) {
                // First find existing unreadCount for each member
                const existingUnreadCounts = conversation.unreadCount || [];
                const updatedUnreadCounts = conversation.groupMembers.map(memberId => {
                    const existing = existingUnreadCounts.find(u => u.userId === memberId);
                    return {
                        userId: memberId,
                        count: memberId === sender.userId ? 0 : ((existing?.count || 0) + 1),
                        lastReadMessageId: memberId === sender.userId ? messageDetailId : (existing?.lastReadMessageId || null)
                    };
                });

                await Conversation.findOneAndUpdate(
                    { conversationId },
                    {
                        ...updateData,
                        $set: { unreadCount: updatedUnreadCounts }
                    }
                );
            } else {
                const receiverId = conversation.creatorId === sender.userId ?
                    conversation.receiverId : conversation.creatorId;

                const existingUnreadCounts = conversation.unreadCount || [];
                const updatedUnreadCounts = [
                    {
                        userId: sender.userId,
                        count: 0,
                        lastReadMessageId: messageDetailId
                    },
                    {
                        userId: receiverId,
                        count: (existingUnreadCounts.find(u => u.userId === receiverId)?.count || 0) + 1,
                        lastReadMessageId: existingUnreadCounts.find(u => u.userId === receiverId)?.lastReadMessageId || null
                    }
                ];

                await Conversation.findOneAndUpdate(
                    { conversationId },
                    {
                        ...updateData,
                        $set: { unreadCount: updatedUnreadCounts }
                    }
                );
            }

            await User.updateOne(
                { userId: sender.userId },
                { lastActive: new Date() }
            );

            const socketController = getSocketController();
            socketController.emitNewMessage(conversationId, {
                ...message,
                messageId: message.messageDetailId
            }, {
                userId: sender.userId,
                fullname: sender.fullname,
                avatar: sender.urlavatar || null
            });

            res.status(201).json(message);
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

    async recallMessage(req, res) {
        try {
            const userId = req.userId;
            const messaageId = req.params.messageId;

            const message = await MessageDetail.findOne({
                messageDetailId: messaageId,
                senderId: userId
            });

            if (!message) {
                return res.status(404).json({ message: 'Message not found or you are not authorized to recall it' });
            }
            message.isRecall = true;
            await message.save();

            const conversation = await Conversation.findOne({
                conversationId: message.conversationId,
                $or: [
                    { creatorId: userId },
                    { receiverId: userId },
                    { groupMembers: { $in: [userId] } }
                ]
            })

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found or access denied' });
            }

            if (conversation.newestMessageId === message.messageDetailId) {
                await Conversation.findOneAndUpdate(
                    { conversationId: conversation.conversationId },
                    {
                        $set: {
                            'lastMessage.isRecall': true,
                            lastChange: new Date().toISOString()
                        }
                    }
                );
            }

            await User.updateOne(
                { userId: userId },
                { lastActive: new Date() }
            );

            const socketController = getSocketController();
            socketController.emitRecallMessage(conversation.conversationId, message.messageDetailId);

            res.json({ message: 'Message recalled successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async deleteMessage(req, res) {
        try {
            const userId = req.userId;
            const messageId = req.params.messageId;
            const message = await MessageDetail.findOne({
                messageDetailId: messageId
            })

            if (!message) {
                return res.status(404).json({ message: 'Message not found' });
            }

            if (message.hiddenFrom?.includes(userId)) {
                return res.status(404).json({ message: 'Message not found' });
            }

            await MessageDetail.updateOne(
                { messageDetailId: messageId },
                { $addToSet: { hiddenFrom: userId } }
            );

            res.json({ message: 'Message deleted successfully' });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async pinMessage(req, res) {
        try {
            const userId = req.userId;
            const messageId = req.params.messageId;
            const user = await User.findOne({ userId });

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const message = await MessageDetail.findOne({
                messageDetailId: messageId
            });

            if (!message) {
                return res.status(404).json({ message: 'Message not found' });
            }

            const conversation = await Conversation.findOne({
                conversationId: message.conversationId,
                $or: [
                    { creatorId: userId },
                    { receiverId: userId },
                    { groupMembers: { $in: [userId] } }
                ]
            });

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found or access denied' });
            }

            await MessageDetail.updateOne(
                { messageDetailId: messageId },
                {
                    isPinned: true,
                    pinnedAt: new Date().toISOString()
                }
            );
            
            await Conversation.updateOne(
                { 
                    conversationId: message.conversationId,
                    'pinnedMessages.messageDetailId': messageId 
                },
                {
                    $set: {
                        'pinnedMessages.$': {
                            messageDetailId: messageId,
                            content: message.content,
                            type: message.type,
                            senderId: message.senderId,
                            pinnedAt: new Date().toISOString(),
                            pinnedBy: userId
                        }
                    }
                }
            );

            // Nếu không tìm thấy để cập nhật, thêm mới
            await Conversation.updateOne(
                { 
                    conversationId: message.conversationId,
                    'pinnedMessages.messageDetailId': { $ne: messageId }
                },
                {
                    $push: {
                        pinnedMessages: {
                            messageDetailId: messageId,
                            content: message.content,
                            type: message.type,
                            senderId: message.senderId,
                            pinnedAt: new Date().toISOString(),
                            pinnedBy: userId
                        }
                    }
                }
            );

            await User.updateOne(
                { userId: userId },
                { lastActive: new Date() }
            );

            await notificationController.createNotification(
                'PIN_MESSAGE',
                message.conversationId,
                userId,
                [],
                `${user.fullname} đã ghim tin nhắn ${message.content}`
            )

            const socketController = getSocketController();
            socketController.emitPinMessage(conversation.conversationId, messageId, userId);
            res.json({ message: 'Message pinned successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    async unpinMessage(req, res) {
        try {
            const userId = req.userId;
            const messageId = req.params.messageId;
            const user = await User.findOne({ userId });

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const message = await MessageDetail.findOne({
                messageDetailId: messageId
            });

            if (!message) {
                return res.status(404).json({ message: 'Message not found' });
            }

            if (!message.isPinned) {
                return res.status(400).json({ message: 'Message is not pinned' });
            }

            const conversation = await Conversation.findOne({
                conversationId: message.conversationId,
                $or: [
                    { creatorId: userId },
                    { receiverId: userId },
                    { groupMembers: { $in: [userId] } }
                ]
            })
            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found or access denied' });
            }

            await MessageDetail.updateOne(
                { messageDetailId: messageId },
                {
                    isPinned: false,
                    pinnedAt: null
                }
            )
            await Conversation.updateOne(
                { conversationId: message.conversationId },
                {
                    $pull: {
                        pinnedMessages: {
                            messageDetailId: messageId
                        }
                    }
                }
            )

            await User.updateOne(
                { userId: userId },
                { lastActive: new Date() }
            )

            await notificationController.createNotification(
                'UNPIN_MESSAGE',
                message.conversationId,
                userId,
                [],
                `${user.fullname} đã bỏ ghim tin nhắn ${message.content}`
            )

            const socketController = getSocketController();
            socketController.emitUnpinMessage(conversation.conversationId, messageId, userId);
            res.json({ message: 'Message unpinned successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async replyMessage(req, res) {
        try {
            const userId = req.userId;
            const messageId = req.params.messageId;
            const { content } = req.body;
            const user = await User.findOne({ userId });

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const message = await MessageDetail.findOne({
                messageDetailId: messageId
            });

            if (!message) {
                return res.status(404).json({ message: 'Message not found' });
            }

            if (message.hiddenFrom?.includes(userId)) {
                return res.status(404).json({ message: 'Message not found' });
            }

            const conversation = await Conversation.findOne({
                conversationId: message.conversationId,
                $or: [
                    { creatorId: userId },
                    { receiverId: userId },
                    { groupMembers: { $in: [userId] } }
                ]
            });

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found or access denied' });
            }

            if (!conversation.isGroup) {
                const receiver = conversation.creatorId === user.userId ?
                    await User.findOne({ userId: conversation.receiverId }) :
                    await User.findOne({ userId: conversation.creatorId });

                if (receiver.blockList?.includes(user.userId)) {
                    return res.status(403).json({ message: 'You have been blocked by the recipient' });
                }

                if (user.blockList?.includes(receiver.userId)) {
                    return res.status(403).json({ message: 'You have blocked the recipient' });
                }

                const isFriend = await FriendRequest.findOne({
                    $or: [
                        { senderId: user.userId, receiverId: receiver.userId, status: 'accepted' },
                        { senderId: receiver.userId, receiverId: user.userId, status: 'accepted' }
                    ]
                })

                if (!isFriend && receiver.settings?.block_msg_from_strangers) {
                    return res.status(403).json({ message: 'Recipient does not accept messages from non-friends' });
                }
            }

            const last3Digits = user.phone.slice(-3);
            const currentDate = new Date();
            const formattedDate = currentDate.getFullYear().toString().slice(-2) +
                (currentDate.getMonth() + 1).toString().padStart(2, '0') +
                currentDate.getDate().toString().padStart(2, '0') +
                currentDate.getHours().toString().padStart(2, '0') +
                currentDate.getMinutes().toString().padStart(2, '0') +
                currentDate.getSeconds().toString().padStart(2, '0');
            const messageDetailId = `msg${last3Digits}${formattedDate}-${uuidv4()}`;

            const replyMessage = await MessageDetail.create({
                messageDetailId: messageDetailId,
                senderId: userId,
                conversationId: message.conversationId,
                type: 'text',
                content,
                createdAt: new Date().toISOString(),
                isReply: true,
                messageReplyId: message.messageDetailId,
                replyData: {
                    content: message.content,
                    type: message.type,
                    senderId: message.senderId,
                    attachment: message.attachment,
                },
                sendStatus: 'sent'
            });

            await Conversation.findOneAndUpdate(
                { conversationId: message.conversationId },
                {
                    newestMessageId: replyMessage.messageDetailId,
                    lastMessage: {
                        content: replyMessage.content,
                        type: replyMessage.type,
                        senderId: replyMessage.senderId,
                        createdAt: replyMessage.createdAt
                    },
                    lastChange: replyMessage.createdAt
                }
            )

            await User.updateOne(
                { userId: userId },
                { lastActive: new Date() }
            );

            const socketController = getSocketController();
            socketController.emitNewMessage(conversation.conversationId, replyMessage, user);

            res.status(201).json(replyMessage);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async forwardImageMessage(req, res) {
        try {
            const userId = req.userId;
            const messageId = req.params.messageId;
            const { conversationId } = req.body; 
            const sender = await User.findOne({ userId });

            if (!sender) {
                return res.status(404).json({ message: 'User not found' }); 
            }

            const message = await MessageDetail.findOne({
                messageDetailId: messageId 
            })

            if (!message) {
                return res.status(404).json({ message: 'Message not found' }); 
            }

            if (message.hiddenFrom?.includes(userId)) {
                return res.status(404).json({ message: 'Message not found' }); 
            }

            const conversation = await Conversation.findOne({
                conversationId: conversationId,
                $or: [
                    { creatorId: userId },
                    { receiverId: userId },
                    { groupMembers: { $in: [userId] } }
                ]
            });

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found or access denied' });
            }

            if (!conversation.isGroup) {
                const receiver = conversation.creatorId === sender.userId ?
                    await User.findOne({ userId: conversation.receiverId }) :
                    await User.findOne({ userId: conversation.creatorId });

                if (receiver.blockList?.includes(sender.userId)) {
                    return res.status(403).json({ message: 'You have been blocked by the recipient' });
                }

                if (sender.blockList?.includes(receiver.userId)) {
                    return res.status(403).json({ message: 'You have blocked the recipient' });
                }

                const isFriend = await FriendRequest.findOne({
                    $or: [
                        { senderId: sender.userId, receiverId: receiver.userId, status: 'accepted' },
                        { senderId: receiver.userId, receiverId: sender.userId, status: 'accepted' }
                    ]
                })

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

            const attachment = message.attachment;
            const forwardMessage = await MessageDetail.create({
                messageDetailId: messageDetailId,
                senderId: sender.userId,
                conversationId,
                type: message.type,
                content: message.content,
                attachment: message.attachment,
                createdAt: new Date().toISOString(),
                sendStatus: 'sent'
            });

            await Conversation.findOneAndUpdate({ conversationId: conversationId }, {
                $push: {
                    listImage: {
                        url: attachment.url,
                        downloadUrl: attachment.downloadUrl,
                    }
                }
            })

            const updateData = {
                newestMessageId: messageDetailId,
                lastMessage: {
                    content: message.content || attachment.name,
                    type: message.type,
                    senderId: sender.userId,
                    createdAt: message.createdAt
                },
                lastChange: message.createdAt
            };

            if (conversation.isGroup) {
                // First find existing unreadCount for each member
                const existingUnreadCounts = conversation.unreadCount || [];
                const updatedUnreadCounts = conversation.groupMembers.map(memberId => {
                    const existing = existingUnreadCounts.find(u => u.userId === memberId);
                    return {
                        userId: memberId,
                        count: memberId === sender.userId ? 0 : ((existing?.count || 0) + 1),
                        lastReadMessageId: memberId === sender.userId ? messageDetailId : (existing?.lastReadMessageId || null)
                    };
                });

                await Conversation.findOneAndUpdate(
                    { conversationId },
                    {
                        ...updateData,
                        $set: { unreadCount: updatedUnreadCounts }
                    }
                );
            } else {
                const receiverId = conversation.creatorId === sender.userId ?
                    conversation.receiverId : conversation.creatorId;

                const existingUnreadCounts = conversation.unreadCount || [];
                const updatedUnreadCounts = [
                    {
                        userId: sender.userId,
                        count: 0,
                        lastReadMessageId: messageDetailId
                    },
                    {
                        userId: receiverId,
                        count: (existingUnreadCounts.find(u => u.userId === receiverId)?.count || 0) + 1,
                        lastReadMessageId: existingUnreadCounts.find(u => u.userId === receiverId)?.lastReadMessageId || null
                    }
                ];

                await Conversation.findOneAndUpdate(
                    { conversationId },
                    {
                        ...updateData,
                        $set: { unreadCount: updatedUnreadCounts }
                    }
                );
            }

            await User.updateOne(
                { userId: sender.userId },
                { lastActive: new Date() }
            );

            const socketController = getSocketController();
            socketController.emitNewMessage(conversation.conversationId, forwardMessage, sender);

            res.status(201).json(forwardMessage);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async markMessageAsRead(req, res) {
        try {
            const userId = req.userId;
            const user = await User.findOne({ userId });
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const conversationId = req.params.conversationId;
            const conversation = await Conversation.findOne({
                conversationId,
                $or: [
                    { creatorId: userId },
                    { receiverId: userId },
                    { groupMembers: { $in: [userId] } }
                ]
            })

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found or access denied' });
            }

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
            )

            await Conversation.updateOne(
                { conversationId },
                {
                    $set: {
                        'unreadCount.$[elem].lastReadMessageId': conversation.newestMessageId,
                        'unreadCount.$[elem].count': 0
                    }
                },
                {
                    arrayFilters: [{ 'elem.userId': userId }]
                }
            );

            await User.updateOne(
                { userId: userId },
                { lastActive: new Date() }
            )

            const socketController = getSocketController();
            socketController.emitReadMessage(conversationId, {
                userId: userId,
                fullname: user.fullname,
                avatar: user.urlavatar || null
            });

            res.json({ message: 'Message marked as read successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

}

module.exports = MessageDetailController;