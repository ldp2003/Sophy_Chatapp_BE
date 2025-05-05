const dynamoose = require("dynamoose");
const mongoose = require('mongoose');

const { v4: uuidv4 } = require("uuid");

const schema = new mongoose.Schema({
  friendRequestId: {
    type: "string",
    hashKey: true,
    index: true,
    default: () => uuidv4(),
  },
  senderId: {
    type: "string",
    ref: "User",
    index: true,
  },
  receiverId: {
    type: "string",
    ref: "User",
    index: true,
  },
  message: {
    type: "string",
    default: "",
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: () => new Date(),
  },
  updatedAt: {
    type: Date,
    default: () => new Date(),
  },
  deletionDate: {
    type: Date,
    default: null,
    index: { expireAfterSeconds: 604800 } // 7 days in seconds (7 * 24 * 60 * 60)
}
});

//const FriendRequest = dynamoose.model("FriendRequest", schema);
const FriendRequest = mongoose.model('FriendRequest', schema);

module.exports = FriendRequest;