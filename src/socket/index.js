const socketIo = require('socket.io');
const SocketController = require('./socketController');

let socketController = null;

const initializeSocket = (server) => {
    const io = socketIo(server, {
        cors: {
            origin: [
                'https://web-chat-sophy-kien-thucs-projects.vercel.app',
                'https://web-chat-sophy-git-fil-kien-thucs-projects.vercel.app',
                'https://web-chat-sophy.vercel.app',
                'https://web-chat-sophy-git-devtan-kien-thucs-projects.vercel.app',
                'http://localhost:3000',       // For local development
                'http://localhost:5173',
                'https://localhost:3000',       // For local development
                'https://localhost:5173',
            ],
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            credentials: true
        },
        connectionStateRecovery: {
            maxDisconnectionDuration: 2 * 60 * 1000,
            skipMiddlewares: true
        },
    });

    socketController = new SocketController(io);
    return io;
};

const getSocketController = () => socketController;

module.exports = {
    initializeSocket,
    getSocketController
};