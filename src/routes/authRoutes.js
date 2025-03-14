const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const auth = require('../middleware/auth');

const authController = new AuthController();

router.post('/login', authController.login.bind(authController));
router.post('/logout', auth, authController.logout.bind(authController));

module.exports = router;