const express = require('express');
const ChatController = require('../controllers/index').ChatController;
const AuthController = require('../controllers/AuthController');
const UserController = require('../controllers/UserController');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');

const setRoutes = (app) => {
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
};

module.exports = setRoutes;