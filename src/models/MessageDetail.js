const dynamoose = require('dynamoose');
const moment = require('moment-timezone');
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    messageDetailID: {
        type: String,
        hashKey: true,
    },
    senderID: String,
    conversationID: {
        type: String,
        index: {
            global: true,
            name: 'IDConversation-dateTime-index',
            rangeKey: 'dateTime'
        }
    },
    type: String,
    content: String,
    createdAt: {
        type: String,
        default: moment.tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss.SSS'),
    },
    isRemove: {
        type: Boolean,
        default: false,
    },
    isRecall: {
        type: Boolean,
        default: false,
    },
    isReply: {
        type: Boolean,
        default: false,
    },
    messageReplyID: {
        type: String,
        default: null,
    },
    replyData: {
        type: Object,
        schema: {
            content: String,
            type: String,
            senderName: String
        },
        default: null
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
                userID: String,
                reaction: String, 
                createdAt: String
            }
        }],
        default: []
    },
    attachments: {
        type: Array,
        schema: [{
            type: Object,
            schema: {
                type: String, 
                url: String,
                name: String,
                size: Number,
                mimeType: String
            }
        }],
        default: []
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
    deletedFor: {
        type: Array,
        schema: [String],
        default: []
    },
    readBy: {
        type: Array,
        schema: [{
            type: Object,
            schema: {
                userID: String,
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
                userID: String,
                deliveredAt: String
            }
        }],
        default: []
    },
});

//const MessageDetail = dynamoose.model("MessageDetail", schema);
const MessageDetail = mongoose.model('MessageDetail', schema);

module.exports = MessageDetail;