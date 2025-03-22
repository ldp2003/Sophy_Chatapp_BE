const express = require('express');
const router = express.Router();
const ConversationController = require('../controllers/ConversationController');
const auth = require('../middleware/auth');

const conversationController = new ConversationController();

router.get('/', auth, conversationController.getConversations.bind(conversationController));
// router.get('/groups', auth, conversationController.getGroups.bind(conversationController));
// router.get('/:conversationId', auth, conversationController.getConversationById.bind(conversationController));
router.post('/create', auth, conversationController.createConversation.bind(conversationController));
// router.post('/group/create', auth, conversationController.createGroup.bind(conversationController));
// router.put('/group/:conversationId/add/:userId', auth, conversationController.addUserToGroup.bind(conversationController));
// router.put('/group/:conversationId/remove/:userId', auth, conversationController.removeUserFromGroup.bind(conversationController));
// router.delete('/group/:conversationId', auth, conversationController.deleteGroup.bind(conversationController));
// router.put('/group/:conversationId/leave', auth, conversationController.leaveConversation.bind(conversationController));

module.exports = router;