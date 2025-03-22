const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const auth = require('../middleware/auth');
const userController = new UserController();

router.get('/get-user/:phone', auth, userController.getUserByPhone.bind(userController));
router.get('/search/:param', auth, userController.searchUsers.bind(userController));
// router.put('/update-user/name', auth, userController.updateName.bind(userController));
// router.put('/update-user/avatar', auth, userController.updateAvatar.bind(userController));
// router.put('/update-user/info', auth, userController.updateInfo.bind(userController));
// router.get('/friends', auth, userController.getFriends.bind(userController));
// router.get('/friends/:phone', auth, userController.getFriendDetail.bind(userController));
// router.put('/block/:userId', auth, userController.blockUser.bind(userController));
// router.delete('/unblock/:user:Id', auth, userController.unblockUser.bind(userController));
// router.get('/blocked', auth, userController.getBlockedUsers.bind(userController));
// router.post('/friend-requests/send-request/:userId', auth, userController.sendFriendRequest.bind(userController));
// router.get('/friend-requests', auth, userController.getFriendRequests.bind(userController));
// router.put('/friend-requests/accept-request/:requestId', auth, userController.acceptFriendRequest.bind(userController));
// router.put('/friend-requests/reject-request/:requestId', auth, userController.rejectFriendRequest.bind(userController));

module.exports = router;