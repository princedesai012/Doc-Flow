require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const whatsappService = require('./services/whatsapp');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for image uploads

// Routes
app.use('/api', apiRoutes);

// Socket.io
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.set('io', io);

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Send current WA status on connect
    const status = whatsappService.getStatus();
    if (status.qrCodeUrl) {
        socket.emit('whatsapp_qr', status.qrCodeUrl);
    }
    if (status.isReady) {
        socket.emit('whatsapp_ready');
    }

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Database
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// WhatsApp Init
whatsappService.initialize(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
