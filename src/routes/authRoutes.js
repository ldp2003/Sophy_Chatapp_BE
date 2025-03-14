const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');

const authController = new AuthController();

router.post('/login', authController.login.bind(authController));

module.exports = router;