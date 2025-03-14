const dynamoose = require('dynamoose');
const moment = require('moment-timezone');

const schema = new dynamoose.Schema({
    IDBucketMessage: {
        type: String,
        hashKey: true    
    },
    IDConversation: {   
        type: String,
        index: {
            global: true,
            name: 'IDConversation-createdAt-index',
            rangeKey: 'createdAt'
        }
    },
    messageCount: {
        type: Number,
        default: 0
    },
    listIDMessageDetail: {
        type: Array,
        schema: [String]
    },
    IDNextBucket: {
        default: "",
        type: String
    },
    createdAt: {        
        type: String,
        default: moment.tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DDTHH:mm:ss.SSS')
    }
});

//const BucketMessage = dynamoose.model("BucketMessage", schema);
const BucketMessage = mongoose.model('BucketMessage', schema);

module.exports = BucketMessage;