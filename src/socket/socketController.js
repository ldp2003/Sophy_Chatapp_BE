const User = require('../models/User');
const userSockets = new Map();
const userConversations = new Map();
const qrLoginSessions = new Map();

class SocketController {
    constructor(io) {
        this.io = io;
        this.setupSocketEvents();
    }

    setupSocketEvents() {
        this.io.on('connection', (socket) => {
            console.log('New client connected:', socket.id);

            socket.on('authenticate', (userId) => {
                userSockets.set(userId, socket.id);
                socket.userId = userId;
                
                if (!userConversations.has(userId)) {
                    userConversations.set(userId, new Set());
                }
            });

            socket.on('initQrLogin', (qrToken) => {
                socket.qrToken = qrToken;
                qrLoginSessions.set(qrToken, {
                    initiatorSocket: socket.id,
                    status: 'pending'
                });
            });

            socket.on('scanQrLogin', async ({ qrToken, userId }) => {
                const session = qrLoginSessions.get(qrToken);
                if (session) {
                    session.scannerUserId = userId;
                    session.scannerSocket = socket.id;
                    session.status = 'scanned';

                    const user = await User.findOne({userId}).select('fullname urlavatar');
                    
                    this.io.to(session.initiatorSocket).emit('qrScanned', {
                        fullname: user.fullname,
                        urlavatar: user.urlavatar || null,
                        status: 'scanned',
                        timestamp: Date.now()
                    });
                }
            });

            socket.on('confirmQrLogin', ({ qrToken, confirmed, token }) => {
                const session = qrLoginSessions.get(qrToken);
                if (session) {
                    if (confirmed) {
                        session.status = 'confirmed';
                        session.token = token;
                        this.io.to(session.initiatorSocket).emit('qrLoginConfirmed', {
                            status: 'confirmed',
                            userId: session.scannerUserId,
                            token: token
                        });
                    } else {
                        session.status = 'rejected';
                        this.io.to(session.initiatorSocket).emit('qrLoginRejected');
                    }
                }
            });

            socket.on('joinUserConversations', (conversations) => {
                const userId = socket.userId;
                const userConvSet = userConversations.get(userId);

                if (userConvSet) {
                    userConvSet.forEach(convId => {
                        socket.leave(convId);
                    });
                    userConvSet.clear();
                }

                conversations.forEach(convId => {
                    socket.join(convId);
                    userConvSet.add(convId);
                });
            });

            
            socket.on('typing', ({ conversationId, userId, fullname }) => {
                this.emitUserTyping(conversationId, userId, fullname);
            });

            socket.on('disconnect', () => {
                const userId = socket.userId;
                if (userId) {
                    userSockets.delete(userId);
                    userConversations.delete(userId);
                }

                if (socket.qrToken) {
                    qrLoginSessions.delete(socket.qrToken);
                }
                console.log('Client disconnected:', socket.id);
            });
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

    emitUserTyping(conversationId, userId) {
        this.io.to(conversationId).emit('userTyping', { conversationId, userId, fullname });
    }

    emitNotification(conversationId, notification) {
        this.io.to(conversationId).emit('newNotification', {
            conversationId,
            notification
        });
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