const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const puppeteer = require('puppeteer');
const { launch, getStream } = require('puppeteer-stream');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public')); // Dito ilalagay ang frontend HTML mo

io.on('connection', async (socket) => {
    console.log('📱 User connected, launching cloud browser...');

    // 1. Buksan ang Puppeteer browser sa server na may streaming capability
    const browser = await launch({
        headless: true,
        defaultViewport: {
            width: 1280,
            height: 720,
        },
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.goto('https://www.google.com');

    // 2. Simulan ang video stream mula sa server browser papunta sa user
    const stream = await getStream(page, {
        audio: false,
        video: true,
        videoConstraints: {
            mandatory: {
                minWidth: 1280,
                minHeight: 720,
                maxWidth: 1280,
                maxHeight: 720,
                maxFrameRate: 30,
            },
        },
    });

    console.log('🎥 Streaming started...');

    stream.on('data', (data) => {
        // Ipadala ang video frames sa phone/client gamit ang WebSocket
        socket.emit('video-frame', data);
    });

    // 3. Makinig sa mga utos (click, type, navigate) mula sa phone ng user
    socket.on('navigate', async (url) => {
        const targetUrl = url.startsWith('http') ? url : `https://${url}`;
        console.log(`Navigating to: ${targetUrl}`);
        await page.goto(targetUrl).catch(err => console.log('Nav error:', err));
    });

    socket.on('mouse-click', async ({ x, y }) => {
        await page.mouse.click(x, y);
    });

    socket.on('type-text', async (text) => {
        await page.keyboard.type(text);
    });

    socket.on('disconnect', async () => {
        console.log('❌ User disconnected, closing browser.');
        await stream.destroy();
        await browser.close();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Cloud Browser Server running on port ${PORT}`);
});
      
