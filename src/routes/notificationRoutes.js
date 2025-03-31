const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/NotificationController');
const auth = require('../middleware/auth');

const notificationController = new NotificationController();

router.get('/conversation/:conversationId', auth, notificationController.getConversationNotifications);

module.exports = router;