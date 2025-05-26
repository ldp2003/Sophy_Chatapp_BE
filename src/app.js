const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const connectDB = require('./config/database');
const http = require('http');
const { initializeSocket } = require('./socket');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

app.use(helmet());

// Middleware
const corsOptions = {
    origin: [
        'https://web-chat-sophy-kien-thucs-projects.vercel.app', 
        'https://web-chat-sophy-git-fil-kien-thucs-projects.vercel.app',
        'https://web-chat-sophy.vercel.app',
        'http://localhost:3000',       // For local development
        'http://localhost:5173',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

// Socket.io connection
const io = initializeSocket(server);
app.set('io', io);

// Import routes
const setRoutes = require('./routes/index');
setRoutes(app);

// Connect to MongoDB
connectDB();

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});