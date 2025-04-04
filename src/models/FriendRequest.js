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
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

//const FriendRequest = dynamoose.model("FriendRequest", schema);
const FriendRequest = mongoose.model('FriendRequest', schema);

module.exports = FriendRequest;