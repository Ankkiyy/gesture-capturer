const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3000;
const gestureFile = './gestures.json';

// Ensure gestures.json exists
if (!fs.existsSync(gestureFile)) {
    fs.writeFileSync(gestureFile, JSON.stringify([]));
}

app.use(express.static('public'));

// Handle socket connection
io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('saveGesture', (data) => {
        let gestures = JSON.parse(fs.readFileSync(gestureFile, 'utf-8'));
        
        const { gestureName, points } = data;
        const existing = gestures.find(g => g.gesture === gestureName);

        if (existing) {
            existing.points.push(...points);
        } else {
            gestures.push({ gesture: gestureName, points });
        }

        fs.writeFileSync(gestureFile, JSON.stringify(gestures, null, 4));
        console.log(`Gesture '${gestureName}' saved with ${points.length} frames.`);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
