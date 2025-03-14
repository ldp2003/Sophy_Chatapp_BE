const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const auth = require('../middleware/auth');
const userController = new UserController();

router.get('/get-user/:phone', auth, userController.getUserByPhone.bind(userController));
router.get('/search/:param', auth, userController.searchUsers.bind(userController));


module.exports = router;