const dynamoose = require("dynamoose");
const moment = require('moment-timezone');
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    IDConversation: {
        type: String,
        hashKey: true,
    },
    IDCreator: {  
        type: String,
        rangeKey: true,
        index: {
            global: true,
            name: 'IDCreator-lastChange-index', 
            rangeKey: 'lastChange',
            project: false,
        },
    },
    isGroup: Boolean,
    groupName: String,
    groupAvatar: String,
    IDReceiver: String,
    IDNewestMessage: String,
    isBlock: Boolean,
    rules: {
        type: Object,
        schema: {
          IDOwner: String,
          listIDCoOwner: {
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
                IDMessageDetail: String,
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
                IDUser: String,
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
                IDUser: String,
                count: {
                    type: Number,
                    default: 0
                },
                lastReadMessageID: {
                    type: String,
                    default: null
                }
            }
        }],
        default: []
    },
    createdAt: {
        type: String,
        default: moment.tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss.SSS'),
    },
    
    lastChange: {
        type: String,
        default: moment.tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss.SSS'),
    }
});

//const Conversation = dynamoose.model("Conversation", schema);
const Conversation = mongoose.model('Conversation', schema);

module.exports = Conversation;