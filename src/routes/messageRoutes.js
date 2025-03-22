const express = require('express');
const router = express.Router();
const MessageDetailController = require('../controllers/MessageDetailController');
const auth = require('../middleware/auth');

const messageDetailController = new MessageDetailController();

router.get('/:conversationId', auth, messageDetailController.getMessages);
router.post('/send', auth, messageDetailController.sendMessage);
// router.post('/send-with-attachment', auth, messageDetailController.sendMessageWithAttachment);
// router.put('/:messageId/recall', auth, messageDetailController.recallMessage);
// router.put('/:messageId/delete', auth, messageDetailController.deleteMessage);
// router.put(':/messageId/pin', auth, messageDetailController.pinMessage);
// router.put('/:messageId/unpin', auth, messageDetailController.unpinMessage);
// router.put('/:conversationId/read', auth, messageDetailController.markMessageAsRead);

module.exports = router;