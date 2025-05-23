const Conversation = require('../models/Conversation');
const MessageDetail = require('../models/MessageDetail');
const NotificationController = require('./NotificationController');
const notificationController = new NotificationController();
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
const DatauriParser = require('datauri/parser');
const parser = new DatauriParser();
const { v4: uuidv4 } = require('uuid');
const { getSocketController } = require('../socket');

class ConversationController {
    async getConversations(req, res) {
        try {
            const userId = req.userId;

            const conversations = await Conversation.find({
                $or: [
                    { creatorId: userId },
                    { receiverId: userId },
                    { groupMembers: { $in: [userId] } }
                ]
            })
                .sort({ lastChange: -1 })
                .populate('lastMessage');

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

            const sender = await User.findOne({ userId: senderId });

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
                lastChange: new Date().toISOString(),
                createdAt: new Date().toISOString(),
            });

            const socketController = getSocketController();
            socketController.emitNewConversation(receiverId, {
                conversationId: conversation.conversationId,
                creatorId: conversation.creatorId,
                receiverId: conversation.receiverId,
                createdAt: conversation.createdAt,
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

            if(!groupMembers) {
                return res.status(400).json({ message: 'Group members are required' });
            }
            if (groupMembers.length < 2) {
                return res.status(400).json({ message: 'Group must have at least 3 members' }); 
            }
            
            if(!groupMembers.includes(creatorId))
                groupMembers.push(creatorId);

            const creator = await User.findOne({ userId: creatorId });

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
                rules: {
                    ownerId: creatorId,
                    coOwnerIds: [],
                },
                lastChange: new Date().toISOString(),
                createdAt: new Date().toISOString(),
            });

            const socketController = getSocketController();
            groupMembers.forEach(memberId => {
                if (memberId !== creatorId) {
                    socketController.emitNewConversation(memberId, {
                        conversationId: conversation.conversationId,
                        creatorId: conversation.creatorId,
                        groupName: conversation.groupName,
                        groupMembers: conversation.groupMembers,
                        isGroup: true,
                        rules: conversation.rules,
                        createdAt: conversation.createdAt,
                    });
                }
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
                groupMembers: { $in: [userId] },
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

    async addUserToGroup(req, res) {
        try {
            const { conversationId, userId } = req.params;
            const currentUserId = req.userId;
            const user = await User.findOne({ userId: userId });
            const conversation = await Conversation.findOne({ conversationId });
            const currentUser = await User.findOne({ userId: currentUserId });

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            if (!currentUser) {
                return res.status(404).json({ message: 'CurrentUser not found' });
            }
            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found' });
            }
            if (!conversation.isGroup) {
                return res.status(400).json({ message: 'This is not a group conversation' });
            }

            if (!conversation.groupMembers.includes(currentUserId)) {
                return res.status(403).json({ message: 'You are not a member of this group' });
            }
            if (conversation.groupMembers.includes(userId)) {
                return res.status(400).json({ message: 'User is already a member of this group' });
            }

            if (conversation.blocked && conversation.blocked.includes(userId)) {
                const isOwner = conversation.rules.ownerId === currentUserId;
                const isCoOwner = conversation.rules.coOwnerIds && conversation.rules.coOwnerIds.includes(currentUserId);

                if (!isOwner && !isCoOwner) {
                    return res.status(403).json({ message: 'Only owner and co-owners can add blocked users to the group' });
                }
            }

            const socketController = getSocketController();

            conversation.groupMembers.push(userId);
            if(conversation.formerMembers && conversation.formerMembers.includes(userId)) {
                conversation.formerMembers = conversation.formerMembers.filter(id => id!== userId);
            }

            if (conversation.blocked && conversation.blocked.includes(userId)) {
                conversation.blocked = conversation.blocked.filter(id => id !== userId);
                socketController.emitUnblockUser(conversation.conversationId, userId);
            }
            await conversation.save();

            
            socketController.emitNewConversation(userId, {
                conversationId: conversation.conversationId,
                creatorId: conversation.creatorId,
                groupName: conversation.groupName,
                groupMembers: conversation.groupMembers,
                isGroup: true,
                rules: conversation.rules,
                lastMessage: conversation.lastMessage,
                createdAt: conversation.createdAt,
            });

            //socketController.emitJoinGroup(conversation.conversationId, userId);
            socketController.emitAddUserToGroup(conversation.conversationId, {userId: user.userId, fullname: user.fullname}, {userId: currentUserId, fullname: currentUser.fullname});

            await notificationController.createNotification(
                'ADD_MEMBER',
                conversationId,
                currentUserId,
                [userId],
                `${currentUser.fullname} đã thêm ${user.fullname} vào nhóm`
            );

            res.json(conversation);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async removeUserFromGroup(req, res) {
        try {
            const { conversationId, userId } = req.params;
            const currentUserId = req.userId;
            const user = await User.findOne({ userId: userId })
            const conversation = await Conversation.findOne({ conversationId });
            const currentUser = await User.findOne({ userId: currentUserId })

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            if (!currentUser) {
                return res.status(404).json({ message: 'CurrentUser not found' });
            }
            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found' });
            }
            if (!conversation.isGroup) {
                return res.status(400).json({ message: 'This is not a group conversation' });
            }
            if (!conversation.groupMembers.includes(currentUserId)) {
                return res.status(403).json({ message: 'You are not a member of this group' });
            }
            if (!conversation.groupMembers.includes(userId)) {
                return res.status(400).json({ message: 'User is not a member of this group' });
            }
            if (!conversation.rules) {
                return res.status(400).json({ message: 'Group rules not defined' });
            }

            const isOwner = conversation.rules.ownerId === currentUserId;
            const isCoOwner = conversation.rules.coOwnerIds && conversation.rules.coOwnerIds.includes(currentUserId);
            const targetIsOwner = conversation.rules.ownerId === userId;
            const targetIsCoOwner = conversation.rules.coOwnerIds && conversation.rules.coOwnerIds.includes(userId);
            const socketController = getSocketController();

            if (isOwner) {
                conversation.groupMembers = conversation.groupMembers.filter(memberId => memberId !== userId);

                if (targetIsCoOwner) {
                    conversation.rules.coOwnerIds = conversation.rules.coOwnerIds.filter(id => id !== userId);
                }

                if (!conversation.formerMembers) {
                    conversation.formerMembers = [];
                }
                if (!conversation.formerMembers.includes(userId)) {
                    conversation.formerMembers.push(userId);
                }

                conversation.markModified('rules.coOwnerIds');
                await conversation.save();
                socketController.emitRemoveUserFromGroup(conversation.conversationId, {userId: user.userId, fullname: user.fullname}, {userId: currentUserId, fullname: currentUser.fullname});

                await notificationController.createNotification(
                    'REMOVE_MEMBER',
                    conversationId,
                    currentUserId,
                    [userId],
                    `${currentUser.fullname} đã xóa ${user.fullname} khỏi nhóm`
                );

                return res.json({ message: 'User removed from group successfully' });
            }

            if (isCoOwner) {
                if (targetIsOwner) {
                    return res.status(403).json({ message: 'Co-owners cannot remove the owner' });
                }

                if (targetIsCoOwner) {
                    return res.status(403).json({ message: 'Co-owners cannot remove other co-owners' });
                }
                conversation.groupMembers = conversation.groupMembers.filter(memberId => memberId !== userId);

                if (!conversation.formerMembers) {
                    conversation.formerMembers = [];
                }
                if (!conversation.formerMembers.includes(userId)) {
                    conversation.formerMembers.push(userId);
                }

                await conversation.save();
                socketController.emitRemoveUserFromGroup(conversation.conversationId, {userId: user.userId, fullname: user.fullname}, {userId: currentUserId, fullname: currentUser.fullname});

                await notificationController.createNotification(
                    'REMOVE_MEMBER',
                    conversationId,
                    currentUserId,
                    [userId],
                    `${currentUser.fullname} đã xóa ${user.fullname} khỏi nhóm`
                );
                return res.json({ message: 'User removed from group successfully' });
            }

            return res.status(403).json({ message: 'You do not have permission to remove users from this group' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async setCoOwner(req, res) {
        try {
            const { conversationId, coOwnerIds } = req.body;
            const currentUserId = req.userId;
            const conversation = await Conversation.findOne({ conversationId });
            const currentUser = await User.findOne({ userId: currentUserId });

            if (!currentUser) {
                return res.status(404).json({ message: 'CurrentUser not found' });
            }
            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found' });
            }
            if (!conversation.isGroup) {
                return res.status(400).json({ message: 'This is not a group conversation' });
            }
            if (!conversation.groupMembers.includes(currentUserId)) {
                return res.status(403).json({ message: 'You are not a member of this group' });
            }
            if (!conversation.rules) {
                return res.status(400).json({ message: 'Group rules not defined' });
            }

            const isOwner = conversation.rules.ownerId === currentUserId;

            if (!isOwner) {
                return res.status(403).json({ message: 'Only the owner can set co-owners' });
            }

            for (const userId of coOwnerIds) {
                if (!conversation.groupMembers.includes(userId)) {
                    return res.status(400).json({ message: `User ${userId} is not a member of this group` });
                }

                if (conversation.rules.ownerId === userId) {
                    return res.status(400).json({ message: 'Cannot set owner as co-owner' });
                }
            }

            if (!conversation.rules.coOwnerIds) {
                conversation.rules.coOwnerIds = [];
            }

            const newCoOwnerIds = coOwnerIds.filter(id => !conversation.rules.coOwnerIds.includes(id));
            console.log(newCoOwnerIds);

            for (const userId of coOwnerIds) {
                if (!conversation.rules.coOwnerIds.includes(userId)) {
                    conversation.rules.coOwnerIds.push(userId);
                }
            }

            conversation.markModified('rules.coOwnerIds');
            await conversation.save();

            const socketController = getSocketController();
            socketController.emitSetNewCoOwner(conversation.conversationId, newCoOwnerIds);

            const coOwnerUsers = await User.find({ userId: { $in: coOwnerIds } });
            const coOwnerNames = coOwnerUsers.map(user => user.fullname).join(', ');

            await notificationController.createNotification(
                'SET_CO_OWNER',
                conversationId,
                currentUserId,
                coOwnerIds,
                `${currentUser.fullname} đã bổ nhiệm ${coOwnerNames} làm phó nhóm`
            );

            res.json({
                message: 'Co-owners updated successfully',
                conversation: conversation
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async removeCoOwner(req, res) {
        try {
            const { conversationId, userId } = req.params;
            const currentUserId = req.userId;
            const conversation = await Conversation.findOne({ conversationId });
            const currentUser = await User.findOne({ userId: currentUserId });
            const targetUser = await User.findOne({ userId: userId });

            if (!currentUser) {
                return res.status(404).json({ message: 'CurrentUser not found' });
            }
            if (!targetUser) {
                return res.status(404).json({ message: 'TargetUser not found' });
            }
            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found' });
            }
            if (!conversation.isGroup) {
                return res.status(400).json({ message: 'This is not a group conversation' });
            }
            if (!conversation.groupMembers.includes(currentUserId)) {
                return res.status(403).json({ message: 'You are not a member of this group' });
            }
            if (!conversation.rules) {
                return res.status(400).json({ message: 'Group rules not defined' });
            }
            const isOwner = conversation.rules.ownerId === currentUserId;
            const targetIsCoOwner = conversation.rules.coOwnerIds && conversation.rules.coOwnerIds.includes(userId);

            if (!isOwner) {
                return res.status(403).json({ message: 'Only the owner can remove co-owners' });
            }
            if (!targetIsCoOwner) {
                return res.status(400).json({ message: 'User is not a co-owner' });
            }

            conversation.rules.coOwnerIds = conversation.rules.coOwnerIds.filter(id => id !== userId);

            conversation.markModified('rules.coOwnerIds');
            await conversation.save();

            const socketController = getSocketController();
            socketController.emitRemoveCoOwner(conversation.conversationId, userId);

            await notificationController.createNotification(
                'REMOVE_CO_OWNER',
                conversationId,
                currentUserId,
                [userId],
                `${currentUser.fullname} đã cắt chức phó nhóm của ${targetUser.fullname}`
            )

            res.json({
                message: 'Co-owner removed successfully',
                conversation: conversation
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async setOwner(req, res) {
        try {
            const { conversationId } = req.body;
            const { userId } = req.params;
            const currentUserId = req.userId;
            const conversation = await Conversation.findOne({ conversationId });
            const currentUser = await User.findOne({ userId: currentUserId });
            const targetUser = await User.findOne({ userId: userId });
            if (!currentUser) {
                return res.status(404).json({ message: 'CurrentUser not found' });
            }
            if (!targetUser) {
                return res.status(404).json({ message: 'TargetUser not found' });
            }
            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found' });
            }
            if (!conversation.isGroup) {
                return res.status(400).json({ message: 'This is not a group conversation' });
            }
            if (!conversation.groupMembers.includes(currentUserId)) {
                return res.status(403).json({ message: 'You are not a member of this group' });
            }
            if (!conversation.rules) {
                return res.status(400).json({ message: 'Group rules not defined' });
            }
            const isOwner = conversation.rules.ownerId === currentUserId;

            if (!isOwner) {
                return res.status(403).json({ message: 'Only the owner can set a new owner' });
            }

            if (!conversation.groupMembers.includes(userId)) {
                return res.status(400).json({ message: 'User is not a member of this group' });
            }

            conversation.rules.ownerId = userId;

            if (conversation.rules.coOwnerIds && conversation.rules.coOwnerIds.includes(userId)) {
                conversation.rules.coOwnerIds = conversation.rules.coOwnerIds.filter(id => id !== userId);
            }

            conversation.markModified('rules.ownerId');
            conversation.markModified('rules.coOwnerIds');
            await conversation.save();

            const socketController = getSocketController();
            socketController.emitNewOwner(conversation.conversationId, userId);

            await notificationController.createNotification(
                'SET_OWNER',
                conversationId,
                currentUserId,
                [userId],
                `${currentUser.fullname} đã chuyển quyền chủ nhóm cho ${targetUser.fullname}`
            )

            res.json({
                message: 'Owner updated successfully',
                conversation: conversation
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async deleteGroup(req, res) {
        try {
            const { conversationId } = req.params;
            const currentUserId = req.userId;
            const conversation = await Conversation.findOne({ conversationId });
            const currentUser = await User.findOne({ userId: currentUserId });

            if (!currentUser) {
                return res.status(404).json({ message: 'CurrentUser not found' });
            }
            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found' });
            }
            if (!conversation.isGroup) {
                return res.status(400).json({ message: 'This is not a group conversation' });
            }
            if (!conversation.groupMembers.includes(currentUserId)) {
                return res.status(403).json({ message: 'You are not a member of this group' });
            }
            if (!conversation.rules) {
                return res.status(400).json({ message: 'Group rules not defined' });
            }
            const isOwner = conversation.rules.ownerId === currentUserId;

            if (!isOwner) {
                return res.status(403).json({ message: 'Only the owner can delete the group' });
            }

            conversation.isDeleted = true;
            conversation.deletedAt = new Date();

            await MessageDetail.updateMany(
                { conversationId: conversation.conversationId },
                { deletedAt: conversation.deletedAt  }
            );

            if (!conversation.formerMembers) {
                conversation.formerMembers = [];
            }

            for (const memberId of conversation.groupMembers) {
                if (!conversation.formerMembers.includes(memberId)) {
                    conversation.formerMembers.push(memberId);
                }
            }
            const groupMembers = conversation.groupMembers; // lưu lại cho thông báo

            conversation.groupMembers = [];

            await conversation.save();

            const socketController = getSocketController();
            socketController.emitDeleteGroup(conversation.conversationId);

            await notificationController.createNotification(
                'DELETE_GROUP',
                conversationId,
                currentUserId,
                groupMembers,
                `${currentUser.fullname} đã giải tán nhóm`
            )
            res.json({
                message: 'Group deleted successfully',
                conversation: conversation
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async leaveGroup(req, res) {
        try {
            const { conversationId } = req.params;
            const currentUserId = req.userId;
            const conversation = await Conversation.findOne({ conversationId });
            const currentUser = await User.findOne({ userId: currentUserId });

            if (!currentUser) {
                return res.status(404).json({ message: 'CurrentUser not found' });
            }
            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found' });
            }
            if (!conversation.isGroup) {
                return res.status(400).json({ message: 'This is not a group conversation' });
            }
            if (!conversation.groupMembers.includes(currentUserId)) {
                return res.status(403).json({ message: 'You are not a member of this group' });
            }
            if (!conversation.rules) {
                return res.status(400).json({ message: 'Group rules not defined' });
            }
            if (conversation.rules.ownerId === currentUserId) {
                return res.status(400).json({ message: 'You cant leave because you are the owner of this group' });
            }
            conversation.groupMembers = conversation.groupMembers.filter(memberId => memberId !== currentUserId);

            if (!conversation.formerMembers) {
                conversation.formerMembers = [];
            }
            if (!conversation.formerMembers.includes(currentUserId)) {
                conversation.formerMembers.push(currentUserId);
            }

            if (conversation.rules.coOwnerIds && conversation.rules.coOwnerIds.includes(currentUserId)) {
                conversation.rules.coOwnerIds = conversation.rules.coOwnerIds.filter(id => id !== currentUserId);
            }

            conversation.markModified('rules.coOwnerIds');
            await conversation.save();

            const socketController = getSocketController();
            socketController.emitLeaveGroup(conversation.conversationId, currentUserId);

            await notificationController.createNotification(
                'LEAVE_GROUP',
                conversationId,
                currentUserId,
                [currentUserId],
                `${currentUser.fullname} đã rời khỏi nhóm`
            )

            res.json({
                message: 'You have left the group successfully',
                conversation: conversation
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async blockUserFromGroup(req, res) {
        try {
            const { conversationId, userId } = req.params;
            const currentUserId = req.userId;
            const conversation = await Conversation.findOne({ conversationId });
            const currentUser = await User.findOne({ userId: currentUserId });
            const targetUser = await User.findOne({ userId: userId });

            if (!currentUser) {
                return res.status(404).json({ message: 'CurrentUser not found' });
            }
            if (!targetUser) {
                return res.status(404).json({ message: 'TargetUser not found' });
            }
            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found' });
            }
            if (!conversation.isGroup) {
                return res.status(400).json({ message: 'This is not a group conversation' });
            }
            if (!conversation.groupMembers.includes(currentUserId)) {
                return res.status(403).json({ message: 'You are not a member of this group' });
            }
            if (!conversation.rules) {
                return res.status(400).json({ message: 'Group rules not defined' });
            }

            const isOwner = conversation.rules.ownerId === currentUserId;
            const isCoOwner = conversation.rules.coOwnerIds && conversation.rules.coOwnerIds.includes(currentUserId);
            const targetIsCoOwner = conversation.rules.coOwnerIds && conversation.rules.coOwnerIds.includes(userId);

            if (!isOwner && !isCoOwner) {
                return res.status(403).json({ message: 'Only owner and co-owners can block users from the group' });
            }

            if (targetIsCoOwner && !isOwner) {
                return res.status(403).json({ message: 'Only owner can block co-owners' });
            }

            if (!conversation.blocked) {
                conversation.blocked = [];
            }

            if (!conversation.blocked.includes(userId)) {
                conversation.blocked.push(userId);
            }

            if (conversation.groupMembers.includes(userId)) {
                conversation.groupMembers = conversation.groupMembers.filter(id => id !== userId);
                if (!conversation.formerMembers) {
                    conversation.formerMembers = []; 
                }
                if (!conversation.formerMembers.includes(userId)) {
                    conversation.formerMembers.push(userId); 
                }
            }

            if (targetIsCoOwner) {
                conversation.rules.coOwnerIds = conversation.rules.coOwnerIds.filter(id => id !== userId);
                conversation.markModified('rules.coOwnerIds');
            }

            await conversation.save();

            const socketController = getSocketController();
            socketController.emitBlockUser(conversation.conversationId, userId);

            await notificationController.createNotification(
                'BLOCK_USER',
                conversationId,
                currentUserId,
                [userId],
                `${currentUser.fullname} đã chặn ${targetUser.fullname} khỏi nhóm`
            )

            res.json({
                message: 'User blocked successfully',
                conversation: conversation
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async unblockUserFromGroup(req, res) {
        try {
            const { conversationId, userId } = req.params;
            const currentUserId = req.userId;
            const conversation = await Conversation.findOne({ conversationId });
            const currentUser = await User.findOne({ userId: currentUserId });
            const targetUser = await User.findOne({ userId: userId });

            if (!currentUser) {
                return res.status(404).json({ message: 'CurrentUser not found' });
            }
            if (!targetUser) {
                return res.status(404).json({ message: 'TargetUser not found' });
            }
            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found' });
            }
            if (!conversation.isGroup) {
                return res.status(400).json({ message: 'This is not a group conversation' });
            }
            if (!conversation.groupMembers.includes(currentUserId)) {
                return res.status(403).json({ message: 'You are not a member of this group' });
            }
            if (!conversation.rules) {
                return res.status(400).json({ message: 'Group rules not defined' });
            }

            const isOwner = conversation.rules.ownerId === currentUserId;
            const isCoOwner = conversation.rules.coOwnerIds && conversation.rules.coOwnerIds.includes(currentUserId);

            if (!isOwner && !isCoOwner) {
                return res.status(403).json({ message: 'Only owner and co-owners can unblock users from the group' });
            }

            if (!conversation.blocked) {
                return res.status(400).json({ message: 'No users are blocked in this group' });
            }

            if (!conversation.blocked.includes(userId)) {
                return res.status(400).json({ message: 'User is not blocked in this group' });
            }

            conversation.blocked = conversation.blocked.filter(id => id !== userId);

            await conversation.save();

            const socketController = getSocketController();
            socketController.emitUnblockUser(conversation.conversationId, userId);

            await notificationController.createNotification(
                'UNBLOCK_USER',
                conversationId,
                currentUserId,
                [userId],
                `${currentUser.fullname} đã bỏ chặn ${targetUser.fullname} khỏi nhóm`
            )

            res.json({
                message: 'User unblocked successfully',
                conversation: conversation
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async updateGroupName(req, res) {
        try {
            const { newName } = req.body;
            const { conversationId } = req.params;
            const currentUserId = req.userId;
            const currentUser = await User.findOne({ userId: currentUserId });
            const conversation = await Conversation.findOne({ conversationId });

            if (!newName || newName.trim() === '') {
                return res.status(400).json({ message: 'New name is empty' });
            }

            if (!currentUser) {
                return res.status(404).json({ message: 'CurrentUser not found' });
            }

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found' });
            }

            if (!conversation.isGroup) {
                return res.status(400).json({ message: 'This is not a group conversation' });
            }

            if (!conversation.groupMembers.includes(currentUserId)) {
                return res.status(403).json({ message: 'You are not a member of this group' });
            }

            if (conversation.groupName === newName) {
                return res.status(400).json({ message: 'New name is the same as the current name' });
            }

            if (newName.length < 3 || newName.length > 50) {
                return res.status(400).json({ message: 'New name must be between 3 and 50 characters' });
            }


            await Conversation.findOneAndUpdate(
                { conversationId: conversationId },
                { groupName: newName },
                { new: true }
            );

            const socketController = getSocketController();
            socketController.emitNewGroupName(conversation.conversationId, newName);

            await notificationController.createNotification(
                'UPDATE_GROUP_NAME',
                conversationId,
                currentUserId,
                conversation.groupMembers,
                `${currentUser.fullname} đã đổi tên nhóm thành ${newName}`
            )

            const updatedConversation = await Conversation.findOne({ conversationId });

            res.json({
                message: 'Group name updated successfully',
                conversation: updatedConversation
            });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async updateGroupAvatar(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded' });
            }

            const userId = req.userId;
            const user = await User.findOne({ userId });
            const { conversationId } = req.params;
            const conversation = await Conversation.findOne({ conversationId });

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found' });
            }

            if (!conversation.isGroup) {
                return res.status(400).json({ message: 'This is not a group conversation' });
            }

            if (!conversation.groupMembers.includes(userId)) {
                return res.status(403).json({ message: 'You are not a member of this group' });
            }

            const fileUri = parser.format(
                req.file.originalname,
                req.file.buffer
            ).content;

            const uploadResponse = await cloudinary.uploader.upload(fileUri, {
                folder: 'conversations/${conversationId}/avatar',
                transformation: [
                    { width: 500, height: 500, crop: 'fill' },
                    { quality: 'auto' }
                ]
            });

            let updatedConversation;
            try {
                updatedConversation = await Conversation.findOneAndUpdate(
                    { conversationId: conversationId },
                    { groupAvatarUrl: uploadResponse.secure_url },
                    { new: true }
                );

                if (!updatedConversation) {
                    await cloudinary.uploader.destroy(`conversations/${conversationId}/avatar/${uploadResponse.public_id}`);
                    return res.status(500).json({ message: 'Failed to update group avatar' });
                }
            } catch (dbError) {
                await cloudinary.uploader.destroy(`conversations/${conversationId}/avatar/${uploadResponse.public_id}`);
                return res.status(500).json({ message: 'Failed to update group avatar in database' });
            }

            if (conversation.groupAvatarUrl && uploadResponse.secure_url) {
                const publicId = conversation.groupAvatarUrl.split('/').pop().split('.')[0];
                try {
                    await cloudinary.uploader.destroy(`conversations/${conversationId}/avatar/${publicId}`);
                } catch (error) {
                    console.error('Error deleting old group avatar:', error);
                }
            }

            const socketController = getSocketController();
            socketController.emitNewGroupAvatar(conversation.conversationId, uploadResponse.secure_url);

            await notificationController.createNotification(
                'UPDATE_GROUP_AVATAR',
                conversationId,
                userId,
                [],
                `${user.fullname} đã thay đổi ảnh đại diện nhóm`
            )

            res.json({
                message: 'Group avatar updated successfully',
                conversation: updatedConversation
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async updateBackground(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded' });
            }

            const userId = req.userId;
            const user = await User.findOne({ userId });
            const { conversationId } = req.params;
            const conversation = await Conversation.findOne({
                conversationId: conversationId,
                $or: [
                    { creatorId: userId },
                    { receiverId: userId },
                    { groupMembers: { $in: [userId] } }
                ]
            })

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found or access denied' });
            }

            const fileUri = parser.format(
                req.file.originalname,
                req.file.buffer
            ).content;

            const uploadResponse = await cloudinary.uploader.upload(fileUri, {
                folder: `conversations/${conversationId}/background`,
                transformation: [
                    { quality: 'auto', fetch_format: 'auto' },
                    { flags: 'preserve_transparency' }
                ]
            });

            const updatedConversation = await Conversation.findOneAndUpdate(
                { conversationId: conversationId },
                { background: uploadResponse.secure_url },
                { new: true }
            )

            if (!updatedConversation) {
                await cloudinary.uploader.destroy(`conversations/${conversationId}/background/${uploadResponse.public_id}`);
                return res.status(500).json({ message: 'Failed to update background' });
            }

            if (conversation.background && uploadResponse.secure_url) {
                const publicId = conversation.background.split('/').pop().split('.')[0];
                try {
                    await cloudinary.uploader.destroy(`conversations/${conversationId}/background/${publicId}`);
                } catch (error) {
                    console.error('Error deleting old background:', error);
                }
            }

            await notificationController.createNotification(
                'UPDATE_BACKGROUND',
                conversationId,
                userId,
                [],
                `${user.fullname} đã thay đổi ảnh nền`
            )

            // io.to(conversationId).emit('groupBackgroundUpdated', {
            //     conversationId,
            //     newBackgroundUrl: uploadResponse.secure_url,
            //     updatedBy: userId
            // });
            res.json({
                message: 'Background updated successfully',
                conversation: updatedConversation
            })
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async updateGroupAvatarMobile(req, res) {
        try {
            const { imageBase64 } = req.body;

            if (!imageBase64) {
                return res.status(400).json({ message: 'No image uploaded' });
            }

            if (!imageBase64.startsWith('data:image/')) {
                return res.status(400).json({ message: 'Invalid image format' });
            }

            const userId = req.userId;
            const user = await User.findOne({ userId });
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            const { conversationId } = req.params;
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
            const uploadResponse = await cloudinary.uploader.upload(imageBase64, {
                folder: `conversations/${conversationId}/avatar`,
                transformation: [
                    { width: 500, height: 500, crop: 'fill' },
                    { quality: 'auto' }
                ] 
            })
            const updatedConversation = await Conversation.findOneAndUpdate(
                { conversationId: conversationId },
                { groupAvatarUrl: uploadResponse.secure_url },
                { new: true } 
            )
            if (!updatedConversation) {
                await cloudinary.uploader.destroy(`conversations/${conversationId}/avatar/${uploadResponse.public_id}`);
                return res.status(500).json({ message: 'Failed to update avatar' }); 
            }
            if (conversation.groupAvatarUrl && uploadResponse.secure_url) {
                const publicId = conversation.groupAvatarUrl.split('/').pop().split('.')[0];
                try {
                    await cloudinary.uploader.destroy(`conversations/${conversationId}/avatar/${publicId}`);  
                } 
                catch (error) {
                    console.error('Error deleting old avatar:', error); 
                }
            }

            const socketController = getSocketController();
            socketController.emitNewGroupAvatar(conversation.conversationId, uploadResponse.secure_url);

            await notificationController.createNotification(
                'UPDATE_GROUP_AVATAR',
                conversationId,
                userId,
                [],
                `${user.fullname} đã thay đổi ảnh đại diện nhóm` 
            )
            res.json({
                message: 'Avatar updated successfully',
                conversation: updatedConversation 
            })
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async updateBackgroundMobile(req, res) {
        try {
            const { imageBase64 } = req.body;

            if (!imageBase64) {
                return res.status(400).json({ message: 'No image uploaded' });
            }

            if (!imageBase64.startsWith('data:image/')) {
                return res.status(400).json({ message: 'Invalid image format' });
            }

            const userId = req.userId;
            const user = await User.findOne({ userId });
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            const { conversationId } = req.params;
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

            const uploadResponse = await cloudinary.uploader.upload(imageBase64, {
                folder: `conversations/${conversationId}/background`,
                transformation: [
                    { quality: 'auto', fetch_format: 'auto' },
                    { flags: 'preserve_transparency' }
                ]
            });

            const updatedConversation = await Conversation.findOneAndUpdate(
                { conversationId: conversationId },
                { background: uploadResponse.secure_url },
                { new: true }
            )

            if (!updatedConversation) {
                await cloudinary.uploader.destroy(`conversations/${conversationId}/background/${uploadResponse.public_id}`);
                return res.status(500).json({ message: 'Failed to update background' });
            }

            if (conversation.background && uploadResponse.secure_url) {
                const publicId = conversation.background.split('/').pop().split('.')[0];
                try {
                    await cloudinary.uploader.destroy(`conversations/${conversationId}/background/${publicId}`);
                } catch (error) {
                    console.error('Error deleting old background:', error);
                }
            }

            await notificationController.createNotification(
                'UPDATE_BACKGROUND',
                conversationId,
                userId,
                [],
                `${user.fullname} đã thay đổi ảnh nền`
            )

            res.json({
                message: 'Background updated successfully',
                conversation: updatedConversation
            });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async removeBackgroundMobile(req, res) {
        try {
            const { conversationId } = req.params;
            const userId = req.userId;
            const user = await User.findOne({ userId });
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

            if (!conversation.background) {
                return res.status(400).json({ message: 'Conversation does not have a background' });
            }

            const updatedConversation = await Conversation.findOneAndUpdate(
                { conversationId: conversationId },
                { background: null },
                { new: true }
            );

            if (!updatedConversation) {
                return res.status(500).json({ message: 'Failed to remove background' });
            }

            const publicId = conversation.background.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`conversations/${conversationId}/background/${publicId}`);

            await notificationController.createNotification(
                'REMOVE_BACKGROUND',
                conversationId,
                userId,
                [],
                `${user.fullname} đã xóa ảnh nền`
            )

            res.json({
                message: 'Background removed successfully',
                conversation: updatedConversation
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getSameGroups(req, res) {
        try {
            const userId = req.userId;
            const user = await User.findOne({ userId }).select('-password');
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            const targetUserId = req.params.userId;
            const targetUser = await User.findOne({ userId: targetUserId }).select('-password -deviceTokens -blockList -createdAt');
            if (!targetUser) {
                return res.status(404).json({ message: 'Target user not found' });
            }

            const conversations = await Conversation.find({
                isGroup: true,
                isDeleted: { $ne: true },
                groupMembers: {
                    $all: [userId, targetUserId]
                }
            }).select('-lastMessage -listImage -listFile -pinnedMessages -unreadCount ');

            res.json(conversations);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async pinConversation(req, res) {
        try {
            const { conversationId } = req.params;
            const userId = req.userId;
            
            const updatedUser = await User.findOneAndUpdate(
                { userId },
                { 
                    $addToSet: {
                        pinnedConversations: {
                            conversationId,
                            pinnedAt: new Date()
                        }
                    }
                },
                { new: true }
            );

            if (!updatedUser) {
                return res.status(404).json({ message: 'User not found' });
            }

            const socketController = getSocketController();
            socketController.emitPinnedConversations(userId, updatedUser.pinnedConversations);

            res.json({
                message: 'Conversation pinned successfully',
                pinnedConversations: updatedUser.pinnedConversations
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async unpinConversation(req, res) {
        try {
            const { conversationId } = req.params;
            const userId = req.userId;
            
            const user = await User.findOne({ userId });
            if (!user.pinnedConversations || user.pinnedConversations.length === 0) {
                return res.status(400).json({ message: 'No pinned conversations' });
            }

            user.pinnedConversations = user.pinnedConversations.filter(
                pin => pin.conversationId !== conversationId
            );

            await user.save();

            const socketController = getSocketController();
            socketController.emitPinnedConversations(userId, user.pinnedConversations);

            res.json({
                message: 'Conversation unpinned successfully',
                pinnedConversations: user.pinnedConversations
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = ConversationController;