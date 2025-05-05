const User = require('../models/User');
const userSockets = new Map();
const userConversations = new Map();
const qrLoginSessions = new Map();
const { generateToken04 } = require('../utils/zegoServerAssistant');

require('dotenv').config();
const appID = process.env.ZEGO_APP_ID;
const serverSecret = process.env.ZEGO_SERVER_SECRET;

class SocketController {
    constructor(io) {
        this.io = io;
        this.activeConnections = new Set();
        this.setupSocketEvents();
    }

    setupSocketEvents() {
        this.io.on('connection', (socket) => {
            this.activeConnections.add(socket.id);
            console.log('New client connected:', {
                socketId: socket.id,
                totalConnections: this.activeConnections.size
            });

            socket.isReconnecting = false;
            socket.lastDisconnectTime = null;

            socket.on('authenticate', (userId) => {
                const prevSocketId = userSockets.get(userId);
                const prevSocket = prevSocketId ? this.io.sockets.sockets.get(prevSocketId) : null;

                // Check if this is a reconnection within 5 seconds
                if (prevSocket?.lastDisconnectTime) {
                    const timeSinceDisconnect = Date.now() - prevSocket.lastDisconnectTime;
                    socket.isReconnecting = timeSinceDisconnect < 5000;
                }

                if (prevSocket && prevSocket.id !== socket.id) {
                    if (prevSocket.qrToken && qrLoginSessions.has(prevSocket.qrToken)) {
                        socket.qrToken = prevSocket.qrToken;
                        const session = qrLoginSessions.get(prevSocket.qrToken);
                        session.initiatorSocket = socket.id;
                        qrLoginSessions.set(socket.qrToken, session);
                    }

                    if (socket.isReconnecting && userConversations.has(userId)) {
                        const conversations = userConversations.get(userId);
                        conversations.forEach(convId => {
                            socket.join(convId);
                        });
                    }

                    prevSocket.disconnect(true);
                }

                userSockets.set(userId, socket.id);
                socket.userId = userId;

                if (!userConversations.has(userId)) {
                    userConversations.set(userId, new Set());
                }

                socket.join(`user_${userId}`);

                const effectiveTimeInSeconds = 3600; // Token valid for 1 hour
                const payload = {
                    room_id: '',
                    privilege: {
                        1: 1,   // Login privilege
                        2: 1    // Stream privilege
                    },
                    stream_id_list: null
                };

                try {
                    const token = generateToken04(
                        Number(appID),
                        userId,
                        serverSecret,
                        effectiveTimeInSeconds,
                        payload
                    );

                    socket.emit('zegoToken', {
                        token,
                        appID,
                        userId,
                        effectiveTimeInSeconds
                    });
                } catch (error) {
                    console.error('Failed to generate Zego token:', error);
                }

                console.log('User authenticated:', {
                    userId,
                    socketId: socket.id,
                    isReconnection: socket.isReconnecting,
                    hasQrSession: !!socket.qrToken
                });
            });

            socket.on('disconnect', () => {
                socket.lastDisconnectTime = Date.now();
                this.activeConnections.delete(socket.id);
                const userId = socket.userId;
                if (!socket.isIntentionalDisconnect) {
                    setTimeout(() => {
                        if (userSockets.get(userId) === socket.id) {
                            userSockets.delete(userId);
                            userConversations.delete(userId);
                            if (socket.qrToken) {
                                qrLoginSessions.delete(socket.qrToken);
                            }
                        }
                    }, 5000); //chờ 5 giây để xóa
                } else {
                    userSockets.delete(userId);
                    userConversations.delete(userId);
                }

                console.log('Client disconnected:', {
                    socketId: socket.id,
                    userId: userId || 'Not authenticated',
                    isIntentional: socket.isIntentionalDisconnect || false,
                    remainingConnections: this.activeConnections.size
                });
            });

            socket.on('refreshZegoToken', () => {
                if (!socket.userId) return;

                try {
                    const token = generateToken04(
                        Number(appID),
                        socket.userId,
                        serverSecret,
                        3600,
                        {
                            room_id: '',
                            privilege: {
                                1: 1,
                                2: 1
                            },
                            stream_id_list: null
                        }
                    );

                    socket.emit('zegoToken', {
                        token,
                        appID,
                        userId: socket.userId,
                        effectiveTimeInSeconds: 3600
                    });
                } catch (error) {
                    console.error('Failed to refresh Zego token:', error);
                }
            });

            socket.on('initQrLogin', (qrToken) => {
                socket.qrToken = qrToken;
                qrLoginSessions.set(qrToken, {
                    initiatorSocket: socket.id,
                    status: 'pending'
                });
            });

            socket.on('startCall', (data) => {
                const { conversationId, roomID, callerId, receiverId, isVideo } = data;
                console.log(`Start call from ${callerId} to ${receiverId}, room: ${roomID}`);

                const receiverSocketId = userSockets.get(receiverId);
                if (receiverSocketId) {
                    this.io.to(receiverSocketId).emit('startCall', {
                        conversationId,
                        roomID,
                        callerId,
                        isVideo,
                    });
                } else {
                    console.warn(`Receiver ${receiverId} not online`);
                    socket.emit('callError', { message: 'Người nhận không trực tuyến.' });
                }
            });

            socket.on('endCall', (data) => {
                const { conversationId, receiverId } = data;
                const receiverSocketId = userSockets.get(receiverId);
                if (receiverSocketId) {
                    this.io.to(receiverSocketId).emit('endCall', { conversationId });
                }
            });

            socket.on('scanQrLogin', async ({ qrToken, userId }) => {
                const session = qrLoginSessions.get(qrToken);
                if (session) {
                    session.scannerUserId = userId;
                    session.scannerSocket = socket.id;
                    session.status = 'scanned';

                    const user = await User.findOne({ userId }).select('fullname urlavatar');

                    this.io.to(session.initiatorSocket).emit('qrScanned', {
                        fullname: user.fullname,
                        urlavatar: user.urlavatar || null,
                        status: 'scanned',
                        timestamp: Date.now()
                    });
                }
            });
            socket.on('confirmQrLogin', ({ qrToken, confirmed }) => {
                console.log('got qrToken: ', qrToken);
                const session = qrLoginSessions.get(qrToken);
                console.log('got session:', session);
                if (session) {
                    if (confirmed) {
                        session.status = 'confirmed';
                        this.io.to(session.initiatorSocket).emit('qrLoginConfirmed', {
                            status: 'confirmed',
                            userId: session.scannerUserId,
                            token: qrToken
                        });
                    } else {
                        session.status = 'rejected';
                        this.io.to(session.initiatorSocket).emit('qrLoginRejected');
                    }
                }
            });

            socket.on('joinUserConversations', (conversations) => {
                const userId = socket.userId;
                if (!userId) {
                    console.warn('Attempt to join conversations without authentication');
                    return;
                }

                if (!userConversations.has(userId)) {
                    userConversations.set(userId, new Set());
                }

                const userConvSet = userConversations.get(userId);

                // Clear existing conversations
                if (userConvSet) {
                    userConvSet.forEach(convId => {
                        socket.leave(convId);
                    });
                    userConvSet.clear();
                }

                // Join new conversations
                if (Array.isArray(conversations)) {
                    conversations.forEach(convId => {
                        if (convId) {
                            socket.join(convId);
                            userConvSet.add(convId);
                        }
                    });
                } else {
                    console.warn('Invalid conversations data received:', conversations);
                }
            });


            socket.on('typing', ({ conversationId, userId, fullname }) => {
                this.emitUserTyping(conversationId, userId, fullname);
            });

        });
    }

    handleReconnect(socket, userId) {
        userSockets.set(userId, socket.id);

        if (userConversations.has(userId)) {
            const conversations = userConversations.get(userId);
            conversations.forEach(convId => {
                socket.join(convId);
            });
        }

        console.log('Restored connection state for user:', {
            userId: userId,
            socketId: socket.id,
            hasConversations: userConversations.has(userId)
        });
    }

    emitNewConversation(receiverId, conversationData) {
        const receiverRoom = `user_${receiverId}`;
        this.io.to(receiverRoom).emit('newConversation', {
            conversation: conversationData,
            timestamp: new Date()
        });
    }

    emitNewMessage(conversationId, message, sender) {
        this.io.to(conversationId).emit('newMessage', {
            conversationId,
            message,
            sender: {
                userId: sender.userId,
                fullname: sender.fullname,
                avatar: sender.avatar || null
            }
        });
    }

    emitUserTyping(conversationId, userId, fullname) {
        this.io.to(conversationId).emit('userTyping', { conversationId, userId, fullname });
    }

    emitRecallingMessage(conversationId, messageId) {
        this.io.to(conversationId).emit('messageRecalled', { conversationId, messageId });
    }

    emitPinMessage(conversationId, messageId) {
        this.io.to(conversationId).emit('messagePinned', { conversationId, messageId });
    }

    emitUnpinMessage(conversationId, messageId) {
        this.io.to(conversationId).emit('messageUnpinned', { conversationId, messageId });
    }

    emitReadMessage(conversationId, receiver) {
        this.io.to(conversationId).emit('messageRead', { conversationId, receiver: { userId: receiver.userId, fullname: receiver.fullname, avatar: receiver.avatar || null }, timestamp: new Date() });
    }

    emitJoinGroup(conversationId, userId) {
        this.io.to(conversationId).emit('userJoinedGroup', { conversationId, userId }); 
    }

    emitAddUserToGroup(conversationId, addedUser, addedByUser) {
        this.io.to(conversationId).emit('userAddedToGroup', { conversationId, addedUser, addedByUser });
    }

    emitLeaveGroup(conversationId, userId) {
        this.io.to(conversationId).emit('userLeftGroup', { conversationId, userId });

        const userSocket = userSockets.get(userId);
        if (userSocket) {
            const socket = this.io.sockets.sockets.get(userSocket);
            if (socket) {
                socket.leave(conversationId);
            }
        }
        
        const userConvSet = userConversations.get(userId);
        if (userConvSet) {
            userConvSet.delete(conversationId);
        }
    }

    emitRemoveUserFromGroup(conversationId, kickedUser, kickedByUser) {
        this.io.to(conversationId).emit('userRemovedFromGroup', { conversationId, kickedUser, kickedByUser }); 

        const userSocket = userSockets.get(kickedUser.userId);
        if (userSocket) {
            const socket = this.io.sockets.sockets.get(userSocket);
            if (socket) {
                socket.leave(conversationId);
            }
        }

        const userConvSet = userConversations.get(kickedUser.userId);
        if (userConvSet) {
            userConvSet.delete(conversationId);
        }
    }

    emitNewGroupName(conversationId, newName) {
        this.io.to(conversationId).emit('groupNameChanged', { conversationId, newName }); 
    }

    emitNewGroupAvatar(conversationId, newAvatar) {
        this.io.to(conversationId).emit('groupAvatarChanged', { conversationId, newAvatar }); 
    }

    emitNewOwner(conversationId, newOwner) {
        this.io.to(conversationId).emit('groupOwnerChanged', { conversationId, newOwner });
    }

    emitSetNewCoOwner(conversationId, newCoOwnerIds) {
        this.io.to(conversationId).emit('groupCoOwnerAdded', { conversationId, newCoOwnerIds }); 
    }

    emitRemoveCoOwner(conversationId, removedCoOwner) {
        this.io.to(conversationId).emit('groupCoOwnerRemoved', { conversationId, removedCoOwner });
    }

    emitLeaveGroup(conversationId, userId) {
        this.io.to(conversationId).emit('userLeftGroup', { conversationId, userId });
    }

    emitDeleteGroup(conversationId) {
        this.io.to(conversationId).emit('groupDeleted', { conversationId });
    }

    emitBlockUser(conversationId, blockedUserId) {
        this.io.to(conversationId).emit('userBlocked', { conversationId, blockedUserId });

        const userSocket = userSockets.get(blockedUserId);
        if (userSocket) {
            const socket = this.io.sockets.sockets.get(userSocket);
            if (socket) {
                socket.leave(conversationId);
            }
        }
        
        const userConvSet = userConversations.get(blockedUserId);
        if (userConvSet) {
            userConvSet.delete(conversationId);
        }
    }

    emitUnblockUser(conversationId, unblockedUserId) {
        this.io.to(conversationId).emit('userUnblocked', { conversationId, unblockedUserId });
    }

    emitPinnedConversations(userId, pinnedConversations) {
        this.io.to(`user_${userId}`).emit('pinnedConversations', { pinnedConversations });    
    }

    emitNotification(conversationId, notification) {
        this.io.to(conversationId).emit('newNotification', {
            conversationId,
            notification
        });
    }

    emitFriendRequest(receiverId, friendRequestData) {
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
            this.io.to(receiverSocketId).emit('newFriendRequest', {
                ...friendRequestData,
                timestamp: new Date()
            });
        }
    }

    emitRejectFriendRequest(receiverId, friendRequestData) {
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
            this.io.to(receiverSocketId).emit('rejectedFriendRequest', {
                friendRequestData,
                timestamp: new Date()
            });
        }
    }

    emitAcceptFriendRequest(receiverId, friendRequestData) {
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
            this.io.to(receiverSocketId).emit('acceptedFriendRequest', {
                friendRequestData,
                timestamp: new Date()
            });
        }
    }

    emitRetrieveFriendRequest(receiverId, friendRequestData) {
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
            this.io.to(receiverSocketId).emit('retrievedFriendRequest', {
                friendRequestData,
                timestamp: new Date()
            });
        }
    }

    getQrSession(qrToken) {
        return qrLoginSessions.get(qrToken);
    }

    updateQrSession(qrToken, data) {
        const session = qrLoginSessions.get(qrToken);
        if (session) {
            Object.assign(session, data);
            qrLoginSessions.set(qrToken, session);
        }
    }
}

module.exports = SocketController;