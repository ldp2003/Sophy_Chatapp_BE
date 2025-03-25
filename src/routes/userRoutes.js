const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const FriendRequestController = require('../controllers/FriendRequestController');
const auth = require('../middleware/auth');
const userController = new UserController();
const friendRequestController = new FriendRequestController();

router.get('/get-user/:phone', auth, userController.getUserByPhone.bind(userController));
router.get('/get-user-by-id/:userId', auth, userController.getUserById.bind(userController));
router.get('/search/:param', auth, userController.searchUsers.bind(userController));
// router.put('/update-user/name', auth, userController.updateName.bind(userController));
// router.put('/update-user/avatar', auth, userController.updateAvatar.bind(userController));
// router.put('/update-user/info', auth, userController.updateInfo.bind(userController));
router.get('/friends', auth, userController.getFriends.bind(userController));
router.get('/get-profile/:userId', auth, userController.getProfileById.bind(userController));
// router.put('/block/:userId', auth, userController.blockUser.bind(userController));
// router.put('/unblock/:user:Id', auth, userController.unblockUser.bind(userController));
router.get('/blocked', auth, userController.getBlockedUsers.bind(userController));
// router.post('/friend-requests/send-request/:userId', auth, userController.sendFriendRequest.bind(userController));
router.get('/friend-requests', auth, friendRequestController.getFriendRequests.bind(friendRequestController));
// router.put('/friend-requests/accept-request/:requestId', auth, userController.acceptFriendRequest.bind(userController));
// router.put('/friend-requests/reject-request/:requestId', auth, userController.rejectFriendRequest.bind(userController));

module.exports = router;