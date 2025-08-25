// File: server.js
// This file contains the main logic for the backend server that connects to TikTok Live.

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { WebcastTSEvents, WebcastPushConnection } = require('tiktok-live-connector');

// Create an Express app and an HTTP server
const app = express();
const server = http.createServer(app);

// Create a WebSocket server attached to the HTTP server
const wss = new WebSocket.Server({ server });

let connection;

// Function to handle a new WebSocket connection
wss.on('connection', ws => {
    console.log('Client connected to WebSocket.');

    // Listen for messages from the WebSocket client (e.g., username)
    ws.on('message', message => {
        const data = JSON.parse(message);
        if (data.type === 'connect' && data.username) {
            console.log(`Connecting to TikTok user: ${data.username}`);
            // If a previous connection exists, disconnect it first
            if (connection) {
                connection.disconnect();
            }
            // Create a new TikTok connection
            connectToTikTokLive(data.username, ws);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected from WebSocket.');
        // If no other clients are connected, disconnect the TikTok stream
        if (wss.clients.size === 0 && connection) {
            connection.disconnect();
            console.log('No clients remaining, disconnected from TikTok.');
        }
    });
});

// Function to establish a connection to a TikTok Live stream
function connectToTikTokLive(username, ws) {
    try {
        connection = new WebcastPushConnection(username, {
            processInitialData: false,
            // Configure the proxy if needed (e.g., for region access)
            // requestOptions: {
            //     proxy: 'http://your-proxy-url.com'
            // }
        });

        // Connect to the stream
        connection.connect().then(state => {
            console.info(`Connected to roomId ${state.roomId}`);
        }).catch(err => {
            console.error('Failed to connect to TikTok Live:', err);
            // Send error message to the client
            ws.send(JSON.stringify({
                type: 'error',
                data: {
                    message: `Failed to connect to TikTok user "${username}". Please check the username.`
                }
            }));
        });

        // Set up listeners for different live events
        connection.on(WebcastTSEvents.FOLLOW, data => {
            console.log(`${data.uniqueId} followed!`);
            // Send an alert to the connected client
            ws.send(JSON.stringify({
                type: 'follow',
                data: {
                    message: `${data.uniqueId} just followed!`
                }
            }));
        });

        connection.on(WebcastTSEvents.SHARE, data => {
            console.log(`${data.uniqueId} shared the live stream!`);
            ws.send(JSON.stringify({
                type: 'share',
                data: {
                    message: `${data.uniqueId} shared the stream!`
                }
            }));
        });

        connection.on(WebcastTSEvents.GIFT, data => {
            console.log(`${data.uniqueId} gave a gift!`);
            ws.send(JSON.stringify({
                type: 'gift',
                data: {
                    message: `${data.uniqueId} sent a gift: ${data.giftId} (x${data.repeatCount})`
                }
            }));
        });

        connection.on(WebcastTSEvents.CHAT, data => {
            console.log(`${data.uniqueId} said: ${data.comment}`);
            ws.send(JSON.stringify({
                type: 'chat',
                data: {
                    message: `${data.uniqueId} said: ${data.comment}`
                }
            }));
        });
        
    } catch (err) {
        console.error('Error during connection attempt:', err);
        ws.send(JSON.stringify({
            type: 'error',
            data: {
                message: `An internal error occurred.`
            }
        }));
    }
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
