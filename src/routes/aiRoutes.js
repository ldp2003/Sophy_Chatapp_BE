const express = require('express');
const router = express.Router();
const AIController = require('../controllers/AIController');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');

const aiController = new AIController();

const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: 'Too many requests from this IP, please try again later'
});
router.get('/', auth, aiController.getAllAIConversations.bind(aiController));
router.post('/ai-assistant', aiLimiter ,auth, aiController.processAIRequest.bind(aiController));
router.post('/translate', aiLimiter, auth, aiController.translateText.bind(aiController));
router.post('/detect-language', aiLimiter, auth, aiController.detectLanguage.bind(aiController));

module.exports = router;