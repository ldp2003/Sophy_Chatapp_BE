const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/NotificationController');
const auth = require('../middleware/auth');

const notificationController = new NotificationController();

router.get('/conversation/:conversationId', auth, notificationController.getConversationNotifications);
router.get('/all/conversation/:conversationId', auth, notificationController.getAllConversationNotifications);

module.exports = router;