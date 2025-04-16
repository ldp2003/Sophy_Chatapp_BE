const dynamoose = require("dynamoose");
const moment = require('moment-timezone');
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    conversationId: {
        type: String,
        hashKey: true,
    },
    creatorId: {
        type: String,
        rangeKey: true,
        index: {
            global: true,
            name: 'creatorId-lastChange-index',
            rangeKey: 'lastChange',
            project: false,
        },
    },
    isGroup: Boolean,
    groupName: String,
    groupAvatarUrl: {
        type: String,
        default: null
    },
    background: {
        type: String,
        default: null
    },
    receiverId: String,
    newestMessageId: String,
    lastMessage: {
        type: Object,
        schema: {
            content: String,
            type: String,
            senderId: String,
            createdAt: String,
            isRecall: {
                type: Boolean,
                default: false
            }
        },
        default: null
    },
    blockedBy: {
        type: Array,
        schema: [String],
        default: []
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: String,
        default: null
    },
    formerMembers: {
        type: Array,
        default: [],
        schema: [String],
    },
    rules: {
        type: Object,
        schema: {
            ownerId: String,
            coOwnerIds: {
                type: Array,
                schema: [String]
            }
        }
    },
    groupMembers: {
        type: Array,
        default: [],
        schema: [String],
    },
    listImage: {
        type: Array,
        default: [],
        schema: [String],
    },
    listFile: {
        type: Array,
        default: [],
        schema: [String],
    },
    pinnedMessages: {
        type: Array,
        schema: [{
            type: Object,
            schema: {
                messageDetailId: String,
                content: String,
                type: String,
                senderId: String,
                pinnedBy: String,
                pinnedAt: String
            }
        }],
        default: []
    },
    muteNotifications: {
        type: Array,
        schema: [{
            type: Object,
            schema: {
                userId: String,
                muteUntil: {
                    type: String,
                    default: null // null = mute vĩnh viễn
                },
                muteSettings: {
                    messages: {
                        type: Boolean,
                        default: true
                    },
                    calls: {
                        type: Boolean,
                        default: true
                    }
                }
            }
        }],
        default: []
    },
    unreadCount: {
        type: Array,
        schema: [{
            type: Object,
            schema: {
                userId: String,
                count: {
                    type: Number,
                    default: 0
                },
                lastReadMessageId: {
                    type: String,
                    default: null
                }
            }
        }],
        default: []
    },
    createdAt: {
        type: String,
        default: () => new Date().toISOString()
    },

    lastChange: {
        type: String,
        default: () => new Date().toISOString()
    }
});

//const Conversation = dynamoose.model("Conversation", schema);
const Conversation = mongoose.model('Conversation', schema);

module.exports = Conversation;