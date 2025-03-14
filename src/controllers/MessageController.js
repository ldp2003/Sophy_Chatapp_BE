class MessageController {
    constructor(messageService) {
        this.messageService = messageService;
    }

    async sendMessage(req, res) {
        try {
            const { message, userId } = req.body;
            const newMessage = await this.messageService.sendMessage(message, userId);
            res.status(201).json(newMessage);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getMessages(req, res) {
        try {
            const messages = await this.messageService.getMessages();
            res.status(200).json(messages);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = MessageController;