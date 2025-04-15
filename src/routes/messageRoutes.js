const express = require('express');
const router = express.Router();
const MessageDetailController = require('../controllers/MessageDetailController');
const {uploadImage, uploadFile} = require('../middleware/upload');
const auth = require('../middleware/auth');

const messageDetailController = new MessageDetailController();

router.get('/:conversationId', auth, messageDetailController.getMessages);
router.post('/send', auth, messageDetailController.sendMessage);
router.post('/send-with-image', auth, uploadImage.single('image'), messageDetailController.sendMessageWithImage);
router.post('/send-with-file', auth, uploadFile.single('file'), messageDetailController.sendMessageOnlyFile);
router.put('/recall/:messageId', auth, messageDetailController.recallMessage);
router.put('/delete/:messageId', auth, messageDetailController.deleteMessage);
router.put('/pin/:messageId', auth, messageDetailController.pinMessage);
router.put('/unpin/:messageId', auth, messageDetailController.unpinMessage);
router.post('/reply/:messageId', auth, messageDetailController.replyMessage);
// router.put('/read/:conversationId', auth, messageDetailController.markMessageAsRead);

module.exports = router;