const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const conversationRoutes = require('./conversationRoutes');
const messageRoutes = require('./messageRoutes');
const notificationRoutes = require('./notificationRoutes');
const callRoutes = require('./callRoutes');
const aiRoutes = require('./aiRoutes');

const setRoutes = (app) => {
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/conversations', conversationRoutes);
    app.use('/api/messages', messageRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/call', callRoutes);
    app.use('/api/ai', aiRoutes);
};

module.exports = setRoutes;