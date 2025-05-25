const express = require('express');
const router = express.Router();
const CallController = require('../controllers/CallController');
const auth = require('../middleware/auth');

const callController = new CallController();

router.post('/initiate', auth, callController.initiateCall.bind(callController));

module.exports = router;