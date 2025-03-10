const express = require('express');
const ChatController = require('../controllers/index').ChatController;

const setRoutes = (app) => {
    const chatController = new ChatController();

    app.post('/api/messages', chatController.sendMessage.bind(chatController));
    app.get('/api/messages', chatController.getMessages.bind(chatController));
};

module.exports = setRoutes;