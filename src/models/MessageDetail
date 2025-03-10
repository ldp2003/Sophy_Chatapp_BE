const dynamoose = require('dynamoose');
const moment = require('moment-timezone');
const schema = new dynamoose.Schema({
    IDMessageDetail: {
        type: String,
        hashKey: true,
    },
    IDSender: String,
    IDConversation: String,
    type: String,
    content: String,
    dateTime: {
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
    isPass: {
        type: Boolean,
        default: false,
    },
    isReply: {
        type: Boolean,
        default: false,
    },
    IDMessageReply: {
        type: String,
        default: null,
    },
});

const MessageDetail = dynamoose.model("MessageDetail", schema);

module.exports = MessageDetail;