const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

let client;
let ioInstance;
let qrCodeUrl = '';
let isReady = false;

const initialize = (io) => {
    ioInstance = io;

    // Custom LocalAuth to handle EBUSY errors on Windows
    class CustomLocalAuth extends LocalAuth {
        constructor(opts) {
            super(opts);
        }

        async logout() {
            try {
                await super.logout();
            } catch (error) {
                console.error('CustomLocalAuth: Logout failed (creating new session anyway)', error.message);
                // Ignore EBUSY errors or failed deletes, as we just want to restart
            }
        }
    }

    // Initialize WhatsApp Client with CustomLocalAuth to save session
    client = new Client({
        authStrategy: new CustomLocalAuth(),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        },
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        }
    });

    client.on('qr', (qr) => {
        console.log('QR Code received');
        // Convert QR to Data URL for frontend display
        qrcode.toDataURL(qr, (err, url) => {
            if (!err) {
                qrCodeUrl = url;
                if (ioInstance) ioInstance.emit('whatsapp_qr', url);
            }
        });
    });

    client.on('ready', () => {
        console.log('WhatsApp Client is ready!');
        isReady = true;
        qrCodeUrl = '';
        if (ioInstance) ioInstance.emit('whatsapp_ready');
    });

    client.on('authenticated', () => {
        console.log('WhatsApp Authenticated');
        if (ioInstance) ioInstance.emit('whatsapp_authenticated');
    });

    client.on('auth_failure', msg => {
        console.error('AUTHENTICATION FAILURE', msg);
        if (ioInstance) ioInstance.emit('whatsapp_auth_failure');
    });

    client.on('disconnected', (reason) => {
        console.log('Client was logged out', reason);
        isReady = false;
        if (ioInstance) ioInstance.emit('whatsapp_disconnected');
        // Optional: Re-initialize or destroy
        client.initialize();
    });

    client.initialize();
};

const sendMessage = async (to, message) => {
    if (!isReady) {
        throw new Error('WhatsApp client not ready');
    }
    // Ensure the number is in correct format (remove symbols, append @c.us)
    // Assumes input is a full number with country code e.g. 919876543210
    const cleanNumber = to.replace(/\D/g, '');
    const formattedNumber = `${cleanNumber}@c.us`;

    try {
        const response = await client.sendMessage(formattedNumber, message);
        return response;
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        throw error;
    }
};

const getStatus = () => {
    return { isReady, qrCodeUrl };
};

module.exports = { initialize, sendMessage, getStatus };
