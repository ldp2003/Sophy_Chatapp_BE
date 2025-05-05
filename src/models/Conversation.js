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
    blocked: {
        type: Array,
        schema: [String],
        default: []
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
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
    groupSettings: {
        type: Object,
        schema: {
          memberCanSendMessage: {
            type: Boolean,
            default: true 
          },
          memberCanChangeNameAndAvatar: {
            type: Boolean,
            default: false 
          },
          memberCanPinMessage: {
            type: Boolean,
            default: true
          },
          memberCanCreatePoll: {
            type: Boolean,
            default: true
          },
          memberCanAdd: {
            type: Boolean,
            default: true
          },
          canJoinViaLink: {
            type: Boolean,
            default: true 
          }
        } 
    }
    ,
    groupMembers: {
        type: Array,
        default: [],
        schema: [String],
    },
    listImage: {
        type: Array,
        default: [],
        schema: [{
            type: Object,
            schema: {
                url: String,
                downloadUrl: String,
                senderId: {
                    type: String,
                    required: true,
                    ref: 'User'
                },
                createdAt: {
                    type: String,
                    default: () => new Date().toISOString()
                },
                fromMessageId: {
                    type: String,
                    required: true
                },
                isRecall: {
                    type: Boolean,
                    default: false
                },
                hiddenFrom: {
                    type: Array,
                    schema: [String],
                    default: []
                }
            }
        }]
    },
    listFile: {
        type: Array,
        default: [],
        schema: [{
            type: Object,
            schema: {
                name: String,
                downloadUrl: String,
                senderId: {
                    type: String,
                    required: true,
                    ref: 'User'
                },
                createdAt: {
                    type: String,
                    default: () => new Date().toISOString()
                },
                fromMessageId: {
                    type: String,
                    required: true
                },
                isRecall: {
                    type: Boolean,
                    default: false
                },
                hiddenFrom: {
                    type: Array,
                    schema: [String],
                    default: []
                }
            }
        }]
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

schema.pre('save', async function(next) {
    if (this.isDeleted && !this.deletedAt) {
        this.deletedAt = new Date();
    }
    next();
});

schema.pre('deleteOne', { document: true, query: false }, async function(next) {
    try {
        const MessageDetail = require('./MessageDetail');
        await MessageDetail.deleteMany({ conversationId: this.conversationId });
        next();
    } catch (error) {
        next(error);
    }
});

schema.pre('deleteMany', async function(next) {
    try {
        const MessageDetail = require('./MessageDetail');
        const conversations = await this.model.find(this.getQuery());
        const conversationIds = conversations.map(conv => conv.conversationId);
        await MessageDetail.deleteMany({ conversationId: { $in: conversationIds } });
        next();
    } catch (error) {
        next(error);
    }
});

//7 ngày hết hạn -> xóa conversation
schema.index({ deletedAt: 1 }, { expireAfterSeconds: 604800 });

//const Conversation = dynamoose.model("Conversation", schema);
const Conversation = mongoose.model('Conversation', schema);

module.exports = Conversation;