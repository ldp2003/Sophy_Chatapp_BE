const dynamoose = require('dynamoose');

const messageSchema = new dynamoose.Schema({
    id: {
        type: String,
        hashKey: true
    },
    userId: String,
    message: String,
    timestamp: {
        type: Date,
        default: () => new Date()
    }
});

const Message = dynamoose.model('Message', messageSchema);

module.exports = Message;