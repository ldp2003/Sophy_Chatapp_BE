const mongoose = require('mongoose');

const AIConversationSchema = new mongoose.Schema({
    conversationId: {
        type: String,
        required: true,
        unique: true
    },
    userId: { 
        type: String, 
        required: true 
    },
    messages: [{
        role: { 
            type: String, 
            enum: ['user', 'assistant', 'system'] 
        },
        content: String,
        timestamp: { 
            type: Date, 
            default: Date.now 
        }
    }],
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

AIConversationSchema.index({ userId: 1, conversationId: 1 });
AIConversationSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('AIConversation', AIConversationSchema);