const dynamoose = require('dynamoose');
const moment = require('moment-timezone');
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    conversationId: {
        type: String,
        hashKey: true,
    },
    newestBucketID: String,
    messageCount: {      
        type: Number,
        default: 0
    },
    lastMessageAt: {    
        type: String,
        default: moment.tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss.SSS'),
        index: {
            global: true,
            name: 'lastMessageAt-index'
        }
    },
    lastMessage: {
        type: Object,
        schema: {
            messageDetailId: String,
            content: String,
            type: String,
            senderId: String
        },
        default: null
    }
});

//const Message = dynamoose.model("Message", schema);
const Message = mongoose.model('Message', schema);

module.exports = Message;