const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const auth = require('../middleware/auth');

const authController = new AuthController();

router.post('/login', authController.login.bind(authController));
router.post('/check-used-phone/:phone', authController.checkPhoneLimiter, authController.checkUsedPhone.bind(authController));
router.post('/verify-phone-otp', authController.phoneVerificationLimiter, authController.verifyPhoneOTP.bind(authController));
router.post('/generate-qr-token', authController.generateQrToken.bind(authController));
router.post('/verify-qr-token', auth, authController.verifyQrToken.bind(authController));
router.post('/confirm-qr-login', auth, authController.confirmQrLogin.bind(authController));
router.post('/check-qr-status/:qrToken', authController.checkQrStatus.bind(authController));
router.post('/register', authController.register.bind(authController));
router.post('/logout', auth, authController.logout.bind(authController));
router.patch('/refresh', auth, authController.refreshToken.bind(authController));
router.put('/change-password', auth, authController.changePassword.bind(authController));
router.post('/send-otp-forgot-password', authController.forgotPasswordLimiter, authController.sendOTPForgotPassword.bind(authController));
router.post('/verify-otp-forgot-password', authController.forgotPasswordVerificationLimiter ,authController.verifyPhoneOTP.bind(authController));
router.put('/forgot-password', authController.forgotPassword.bind(authController));

module.exports = router;