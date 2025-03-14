const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');

const userController = new UserController();

router.get('/get-user/:phone', userController.getUserByPhone.bind(userController));
router.get('/search/:param', userController.searchUsers.bind(userController));


module.exports = router;