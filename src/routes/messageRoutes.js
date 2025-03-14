const express = require('express');
const router = express.Router();
const MessageDetailController = require('../controllers/MessageDetailController');
const auth = require('../middleware/auth');

const messageDetailController = new MessageDetailController();

router.post('/send', auth, messageDetailController.sendMessage);
router.get('/:conversationId', auth, messageDetailController.getMessages);

module.exports = router;