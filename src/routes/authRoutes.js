const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const auth = require('../middleware/auth');

const authController = new AuthController();

router.post('/login', authController.login.bind(authController));
router.get('/check-used-phone/:phone', authController.phoneVerificationLimiter ,authController.checkUsedPhone.bind(authController));
router.post('/verify-phone-otp', authController.verifyPhoneOTP.bind(authController));
router.post('/register', authController.register.bind(authController));
router.post('/logout', auth, authController.logout.bind(authController));
router.patch('/refresh', auth, authController.refreshToken.bind(authController));
router.put('/change-password', auth, authController.changePassword.bind(authController));
router.put('/forgot-password', authController.forgotPassword.bind(authController));

module.exports = router;