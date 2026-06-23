const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.post('/send', messageController.sendMessage);
router.get('/chats', messageController.getChats);
router.get('/history', messageController.getChatHistory);

module.exports = router;
