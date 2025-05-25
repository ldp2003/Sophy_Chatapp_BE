const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();
const axios = require('axios');
const AIConversation = require('../models/AIConversation');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const MessageDetail = require('../models/MessageDetail');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Thiết lập ngữ cảnh cho AI
const SOPHY_CONTEXT = `Bạn là Sophy, một trợ lý AI thông minh cho ứng dụng chat. Đặc điểm của bạn:
- Không được đưa ra thông tin userId của bất kỳ ai
- Bạn giao tiếp bằng tiếng Việt một cách tự nhiên và thân thiện
- Bạn giúp người dùng trò chuyện, trả lời câu hỏi và hỗ trợ các vấn đề
- Bạn có kiến thức về văn hóa và xã hội Việt Nam
- Bạn luôn giữ thái độ tích cực và chuyên nghiệp
- Bạn tôn trọng quyền riêng tư của người dùng
- Câu trả lời của bạn ngắn gọn nhưng đầy đủ thông tin
- Khi không chắc chắn, bạn sẽ thừa nhận điều đó`;

class AIController {
    async processAIRequest(req, res) {
        try {
            const { message, conversationId } = req.body;
            const userId = req.userId;
            const user = await User.findOne({ userId }).select('fullname phone');

            // Lấy thông tin cuộc trò chuyện giữa người dùng
            const userConversations = await Conversation.find({
                $or: [
                    { creatorId: userId },
                    { receiverId: userId },
                    { groupMembers: { $in: [userId] } }
                ]
            })
            .sort({ lastChange: -1 })
            .limit(3);

             // Lấy tin nhắn cho mỗi cuộc trò chuyện
             const conversationsWithMessages = await Promise.all(userConversations.map(async (conv) => {
                const messages = await MessageDetail.find({
                    conversationId: conv.conversationId,
                    isRecall: false,
                    hiddenFrom: { $nin: [userId] }
                })
                .sort({ createdAt: -1 })
                .limit(5);

                // Lấy thông tin người tạo và người nhận
                const [creator, receiver] = await Promise.all([
                    User.findOne({ userId: conv.creatorId }).select('fullname'),
                    User.findOne({ userId: conv.receiverId }).select('fullname')
                ]);

                // Lấy thông tin người gửi cho mỗi tin nhắn
                const messagesWithSenders = await Promise.all(messages.map(async (msg) => {
                    const sender = await User.findOne({ userId: msg.senderId }).select('fullname');
                    return {
                        ...msg.toObject(),
                        sender: sender
                    };
                }));

                return {
                    ...conv.toObject(),
                    creator,
                    receiver,
                    messages: messagesWithSenders
                };
            }));

            let aiConversation = await AIConversation.findOne({ 
                userId, 
                conversationId 
            });

            if (!aiConversation) {
                aiConversation = new AIConversation({
                    userId,
                    conversationId: conversationId || `conv${Date.now()}`,
                    messages: []
                });
            }
            // Tạo context với thông tin cuộc trò chuyện người dùng
            const dynamicContext = `
${SOPHY_CONTEXT}

Thông tin người dùng đang tương tác:
- Tên: ${user?.fullname || 'Chưa có tên'}
- Số điện thoại: ${user?.phone || 'Chưa có số điện thoại'}
- ID: ${userId}

Các cuộc trò chuyện gần đây của người dùng:
${conversationsWithMessages.map(conv => {
    const otherPerson = conv.creator?.fullname === user?.fullname 
        ? conv.receiver?.fullname 
        : conv.creator?.fullname;
    
    return `
${conv.isGroup ? `Cuộc trò chuyện nhóm "${conv.groupName || 'Không có tên'}"` : `Cuộc trò chuyện với ${otherPerson || 'Người dùng khác'}`}:
${conv.messages.map(msg => {
    const isCurrentUser = msg.senderId === userId;
    return `  + ${isCurrentUser ? 'Bạn' : (msg.sender?.fullname || 'Người dùng')}: ${msg.content}`;
}).join('\n')}
`}).join('\n')}

Yêu cầu phân tích:
- Trả lời đúng trọng tâm
- Hãy đọc kỹ nội dung các cuộc trò chuyện
- Phân tích context và mạch trò chuyện
- Khi được hỏi về người trò chuyện, hãy cho biết tên của họ (nếu có)
- Đưa ra tư vấn và gợi ý phù hợp
- Tôn trọng quyền riêng tư của người dùng

Câu hỏi/Yêu cầu hiện tại:`;

            // Format history với context mới
            const history = aiConversation.messages.map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }));

            const chat = model.startChat({
                history: history
            });

            // Gửi tin nhắn với context đầy đủ
            const result = await chat.sendMessage([{ text: `${dynamicContext}\nNgười dùng: ${message}` }]);
            const aiResponse = await result.response.text();

            aiConversation.messages.push({
                role: 'user',
                content: message
            }, {
                role: 'assistant',
                content: aiResponse
            });

            aiConversation.updatedAt = new Date();
            await aiConversation.save();

            res.json({
                response: aiResponse,
                conversationId: aiConversation.conversationId
            });

        } catch (error) {
            console.error('Lỗi AI Assistant:', error);
            res.status(500).json({ message: 'Có lỗi xảy ra khi xử lý yêu cầu' });
        }
    }

    async translateText(req, res) {
        try {
            const { text, targetLanguage } = req.body;

            const response = await axios.post('https://translation.googleapis.com/language/translate/v2', {
                q: text,
                target: targetLanguage
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.GOOGLE_TRANSLATE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            res.json({
                translatedText: response.data.data.translations[0].translatedText
            });

        } catch (error) {
            console.error('Translation error:', error);
            res.status(500).json({ message: 'Error translating text' });
        }
    }

    async detectLanguage(req, res) {
        try {
            const { text } = req.body;

            const response = await axios.post('https://translation.googleapis.com/language/translate/v2/detect', {
                q: text
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.GOOGLE_TRANSLATE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            res.json({
                detectedLanguage: response.data.data.detections[0][0].language
            });

        } catch (error) {
            console.error('Language detection error:', error);
            res.status(500).json({ message: 'Error detecting language' });
        }
    }
}

module.exports = AIController;