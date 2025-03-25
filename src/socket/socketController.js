const userSockets = new Map();
const userConversations = new Map();

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

            socket.on('sendMessage', (data) => {
                const { conversationId, message, sender } = data;
                this.io.to(conversationId).emit('newMessage', {
                    conversationId,
                    message,
                    sender
                });
            });

            socket.on('disconnect', () => {
                const userId = socket.userId;
                if (userId) {
                    userSockets.delete(userId);
                    userConversations.delete(userId);
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
        this.io.to(conversationId).emit('userTyping', { conversationId, userId });
    }
}

module.exports = SocketController;