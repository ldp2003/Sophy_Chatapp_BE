const express = require('express');
const router = express.Router();
const ConversationController = require('../controllers/ConversationController');
const auth = require('../middleware/auth');

const conversationController = new ConversationController();

router.get('/', auth, conversationController.getConversations.bind(conversationController));
router.post('/create', auth, conversationController.createConversation.bind(conversationController));

module.exports = router;