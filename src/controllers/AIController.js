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
- Không được đưa ra userId của bất kỳ ai
- Bạn giao tiếp bằng tiếng Việt một cách tự nhiên và thân thiện
- Bạn giúp người dùng trò chuyện, trả lời câu hỏi và hỗ trợ các vấn đề
- Bạn có kiến thức về văn hóa và xã hội Việt Nam
- Bạn luôn giữ thái độ tích cực và chuyên nghiệp
- Bạn tôn trọng quyền riêng tư của người dùng, nhưng cho phép người dùng biết số điện thoại của người khác nếu 2 người là bạn bè
- Câu trả lời của bạn ngắn gọn nhưng đầy đủ thông tin
- Khi không chắc chắn, bạn sẽ thừa nhận điều đó`;

class AIController {
    async getAllAIConversations(req, res) {
        try {
            const userId = req.userId;
            const aiConversations = await AIConversation.find({ userId }).sort({ updatedAt: -1 });
            res.json(aiConversations); 
        } catch (error) {
            console.error('Lỗi khi lấy danh sách cuộc trò chuyện:', error);
            res.status(500).json({ message: 'Có lỗi xảy ra khi lấy danh sách cuộc trò chuyện' });
        }
    }
    async processAIRequest(req, res) {
        try {
            const { message, conversationId } = req.body; /// conversationId này là id của aiConversation, không phải conversationId giữa người với người
            // mặc định nếu ko có nhét conversationId vào thì tự trả về 1 conversationId (của ai) mới rồi trả về 
            const userId = req.userId;
            const user = await User.findOne({ userId }).select('fullname phone friendList');

            const friendsInfo = await Promise.all((user.friendList || []).map(async (friendId) => {
                const friend = await User.findOne({ userId: friendId }).select('fullname phone');
                return friend;
            }));

            // Lấy thông tin cuộc trò chuyện giữa người dùng
            const userConversations = await Conversation.find({
                $or: [
                    { creatorId: userId },
                    { receiverId: userId },
                    { groupMembers: { $in: [userId] } }
                ]
            })
            .sort({ lastChange: -1 })
            .limit(5);

             // Lấy tin nhắn cho mỗi cuộc trò chuyện
            const conversationsWithMessages = await Promise.all(userConversations.map(async (conv) => {
                const messages = await MessageDetail.find({
                    conversationId: conv.conversationId,
                    isRecall: false,
                    hiddenFrom: { $nin: [userId] }
                })
                .sort({ createdAt: -1 })
                .limit(100);

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
                    conversationId: conversationId || `conv${Date.now()}-${userId}`,
                    messages: []
                });
            }
            // Tạo context với thông tin cuộc trò chuyện người dùng
            const dynamicContext = `
${SOPHY_CONTEXT}

Thông tin người dùng đang tương tác:
- Tên: ${user?.fullname || 'Chưa có tên'}
- Số điện thoại: ${user?.phone || 'Chưa có số điện thoại'}
- Danh sách bạn bè:
${friendsInfo.map(friend => `  - ${friend?.fullname || 'Không xác định'}${friend?.phone ? ` (${friend.phone})` : ''}`).join('\n')}

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
- Không được đưa ra thông tin userId của bất kỳ ai
- Trả lời đúng trọng tâm câu hỏi
- Không nhắc lại nội dung cuộc trò chuyện trừ khi được hỏi
- Khi người dùng yêu cầu tìm kiếm hoặc gợi ý, hãy đưa ra gợi ý mới thay vì dựa vào context
- Đưa ra tư vấn và gợi ý phù hợp
- Tôn trọng quyền riêng tư của người dùng
- Nếu không thể trả lời hoặc không tìm thấy đáp án, hãy thừa nhận điều đó hoặc tìm kiếm thông tin liên quan

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
            const { text, targetLanguage, messageId } = req.body;

            if (!text || !targetLanguage) {
                return res.status(400).json({ message: 'Missing required fields' });
            }
            
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