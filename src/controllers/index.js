class ChatController {
    constructor(chatService) {
        this.chatService = chatService;
    }

    async sendMessage(req, res) {
        try {
            const { message, userId } = req.body;
            const newMessage = await this.chatService.sendMessage(message, userId);
            res.status(201).json(newMessage);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getMessages(req, res) {
        try {
            const messages = await this.chatService.getMessages();
            res.status(200).json(messages);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default ChatController;