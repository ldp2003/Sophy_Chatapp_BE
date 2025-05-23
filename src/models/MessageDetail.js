const dynamoose = require('dynamoose');
const moment = require('moment-timezone');
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    messageDetailId: {
        type: String,
        hashKey: true,
    },
    senderId: String,
    conversationId: {
        type: String,
        index: {
            global: true,
            name: 'conversationId-dateTime-index',
            rangeKey: 'dateTime'
        }
    },
    type: {
        type: String,
        enum: ['text', 'text-with-image', 'image', 'video', 'file', 'notification', 'audio', 'pool']
    },
    notification: {
        type: Object,
        schema: {
            type: {
                notiType: String,
                enum: ['ADD_MEMBER', 'REMOVE_MEMBER', 'LEAVE_GROUP', 'SET_OWNER', 'SET_CO_OWNER', 'REMOVE_CO_OWNER', 'UPDATE_GROUP_NAME', 'UPDATE_GROUP_AVATAR', 'UPDATE_BACKGROUND', 'REMOVE_BACKGROUND', 'DELETE_GROUP', 'PIN_MESSAGE', 'UNPIN_MESSAGE'],
                required: true
            },
            actorId: String,
            targetIds: {
                type: Array,
                schema: [String]
            }
        },
    },
    content: String,
    createdAt: {
        type: String,
        default: () => new Date().toISOString()
    },
    hiddenFrom: {
        type: Array,
        schema: [String],  // Mảng userIdS những ai (đã xóa tin nhắn) sẽ không thấy tin nhắn này
        default: []
    },
    isRecall: {
        type: Boolean,
        default: false,
    },
    isReply: {
        type: Boolean,
        default: false,
    },
    messageReplyId: {
        type: String,
        default: null,
    },
    isPinned: {
        type: Boolean,
        default: false,
    },
    pinnedAt: {
        type: String,
        default: null,
    },
    reactions: {
        type: Array,
        schema: [{
            type: Object,
            schema: {
                userId: String,
                reaction: String,
                createdAt: String
            }
        }],
        default: []
    },
    attachment: {
        type: Object,
        schema: {
            type: String,
            url: String,
            downloadUrl: String,
            name: String,
            size: Number,
            duration: Number,
            thumbnail: String
        },
        default: null
    },
    poll: {
        type: Object,
        schema: {
            question: String,
            options: {
                type: Array,
                schema: [{
                    type: Object,
                    schema: {
                        text: String,
                        votes: {
                            type: Array,
                            schema: [String],
                            default: []
                        }
                    }
                }]
            },
            isMultipleChoice: {
                type: Boolean,
                default: false
            },
            expiresAt: String
        },
        default: null
    },
    sendStatus: {
        type: String,
        enum: ['sending', 'sent', 'error'],
        default: 'sending'
    },
    linkPreview: {
        type: Object,
        schema: {
            url: String,
            title: String,
            description: String,
            image: String,
            siteName: String
        },
        default: null
    },
    readBy: {
        type: Array,
        schema: [{
            type: Object,
            schema: {
                userId: String,
                readAt: String
            }
        }],
        default: []
    },
    deliveredTo: {
        type: Array,
        schema: [{
            type: Object,
            schema: {
                userId: String,
                deliveredAt: String
            }
        }],
        default: []
    },
    deletedAt: {
        type: Date,
        default: null
    }
});

schema.virtual('replyData', {
    ref: 'MessageDetail',
    localField: 'messageReplyId',
    foreignField: 'messageDetailId',
    justOne: true
});

// Đảm bảo virtuals được include khi chuyển đổi sang JSON
schema.set('toJSON', { virtuals: true });
schema.set('toObject', { virtuals: true });

schema.pre('save', async function(next) {
    if (!this.isModified('conversationId')) return next();
    
    const Conversation = mongoose.model('Conversation');
    const conversation = await Conversation.findOne({ conversationId: this.conversationId });
    if (conversation && conversation.deletedAt) {
        this.deletedAt = conversation.deletedAt;
    }
    next();
});
schema.index({ deletedAt: 1 }, { expireAfterSeconds: 604800 });

//const MessageDetail = dynamoose.model("MessageDetail", schema);
const MessageDetail = mongoose.model('MessageDetail', schema);

module.exports = MessageDetail;