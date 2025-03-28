const express = require('express');
const router = express.Router();
const ConversationController = require('../controllers/ConversationController');
const auth = require('../middleware/auth');

const conversationController = new ConversationController();

router.get('/', auth, conversationController.getConversations.bind(conversationController));
router.get('/groups', auth, conversationController.getGroups.bind(conversationController));
router.get('/:conversationId', auth, conversationController.getConversationById.bind(conversationController));
router.post('/create', auth, conversationController.createConversation.bind(conversationController));
router.post('/group/create', auth, conversationController.createGroupConversation.bind(conversationController));
router.put('/group/:conversationId/add/:userId', auth, conversationController.addUserToGroup.bind(conversationController));
router.put('/group/:conversationId/remove/:userId', auth, conversationController.removeUserFromGroup.bind(conversationController));
router.put('group/set-co-owner', auth, conversationController.setCoOwner.bind(conversationController));
router.put('/group/:conversationId/remove-co-owner/:userId', auth, conversationController.removeCoOwner.bind(conversationController));
router.put('/group/set-owner/:userId', auth, conversationController.setOwner.bind(conversationController));
router.put('/group/delete/:conversationId', auth, conversationController.deleteGroup.bind(conversationController));
router.put('/group/:conversationId/leave', auth, conversationController.leaveGroup.bind(conversationController));

module.exports = router;