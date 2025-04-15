const express = require('express');
const router = express.Router();
const MessageDetailController = require('../controllers/MessageDetailController');
const auth = require('../middleware/auth');

const messageDetailController = new MessageDetailController();

router.get('/:conversationId', auth, messageDetailController.getMessages);
router.post('/send', auth, messageDetailController.sendMessage);
// router.post('/send-with-attachment', auth, messageDetailController.sendMessageWithAttachment);
router.put('/recall/:messageId', auth, messageDetailController.recallMessage);
router.put('/delete/:messageId', auth, messageDetailController.deleteMessage);
router.put('/pin/:messageId', auth, messageDetailController.pinMessage);
router.put('/unpin/:messageId', auth, messageDetailController.unpinMessage);
// router.post('/reply/:messageId', auth, messageDetailController.replyToMessage);
// router.put('/read/:conversationId', auth, messageDetailController.markMessageAsRead);

module.exports = router;