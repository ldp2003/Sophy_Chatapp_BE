const socketIo = require('socket.io');
const SocketController = require('./socketController');

let socketController = null;

const initializeSocket = (server) => {
    const io = socketIo(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    socketController = new SocketController(io);
    return io;
};

const getSocketController = () => socketController;

module.exports = {
    initializeSocket,
    getSocketController
};