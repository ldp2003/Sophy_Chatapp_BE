const dynamoose = require("dynamoose");
const moment = require('moment-timezone');
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    userID: {
        type: String,
        hashKey: true,
    },
    username: {
        type: String,
        required: true,
        index: {
            global: true,
            name: 'username-index'
        }
    },
    password: {
        type: String,
        required: true
    },
    fullname: String,
    isMale: Boolean,
    phone: String,
    urlavatar: String,
    birthday: String,
    settings: {
        block_msg_from_strangers: {
            type: Boolean,
            default: false
        },
    },
    friendList: {
        type: Array,
        schema: [String],
    },
    blockList: {
        type: Array,
        schema: [String],
    },
    lastActive: {
        type: String,
        default: moment.tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss.SSS')
    },
    deviceTokens: {
        type: Array,
        schema: [String],
        default: []
    }
});

//const User = dynamoose.model("User", schema);
const User = mongoose.model('User', schema);

module.exports = User;