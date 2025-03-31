const mongoose = require('mongoose');
const moment = require('moment-timezone');

const schema = new mongoose.Schema({
    notificationId: {
        type: String,
        required: true,
        unique: true
    },
    conversationId: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['ADD_MEMBER', 'REMOVE_MEMBER', 'LEAVE_GROUP', 'SET_OWNER', 'SET_CO_OWNER', 'REMOVE_CO_OWNER', 'UPDATE_GROUP_NAME', 'UPDATE_GROUP_AVATAR', 'UPDATE_GROUP_BACKGROUND', 'DELETE_GROUP'],
        required: true
    },
    actorId: String,      // ai làm
    targetIds: [{         // ai bị ảnh hưởng, ví dụ như delete thì toàn bộ member bị ảnh hưởng, leave thì target cũng là actor, set owner thì target vừa là actor vừa là người khác
        type: String,
        required: true
    }],
    content: String,
    createdAt: {
        type: String,
        default: moment.tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss.SSS'),
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
    }
});

module.exports = mongoose.model('Notification', schema);