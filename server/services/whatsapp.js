const { Client, LocalAuth, RemoteAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { MongoStore } = require('wwebjs-mongo');
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

    const store = new MongoStore({ mongoose: mongoose });
    // Initialize WhatsApp Client with CustomLocalAuth to save session
    client = new Client({
        authStrategy: new RemoteAuth({
        store: store,
        backupSyncIntervalMs: 300000 // 5 min mein sync karega
    }),

        // --- NEW: Slow Network Settings ---
        authTimeoutMs: 120000, // 2 Minute wait karega authenticate hone ka
        qrMaxRetries: 5,       // 5 baar try karega agar fail hua
        takeoverOnConflict: true, // Agar purana session atka hai to use force close karega

        puppeteer: {
            // Memory Flags (Crash rokne ke liye)
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--single-process',
                '--no-zygote',
                '--disable-gpu'
            ],
            headless: true,
            authTimeoutMs: 0, // Wait indefinitely for auth
            qrMaxRetries: 10, // Retries badhao

            // --- NEW: Timeouts badhaye hain ---
            timeout: 120000,          // Browser start hone ke liye 2 minute
            protocolTimeout: 300000,   // Page load hone ke liye 5 minute (Bohot zaroori hai)
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
        console.error('sendMessage called but client is NOT READY. Status:', { isReady, qrCodeUrl: !!qrCodeUrl });
        throw new Error('WhatsApp client not ready. Please scan QR or link device first.');
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

//

// Is function ko poora replace karo:
const requestPairingCode = async (phoneNumber) => {
    if (!client) {
        throw new Error('WhatsApp Client not initialized');
    }
    if (isReady) {
        throw new Error('WhatsApp is already connected!');
    }

    try {
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        console.log(`Requesting pairing code for: ${cleanNumber}`);

        // --- FIX START ---
        // Hum browser context mein 'onCodeReceivedEvent' function inject kar rahe hain
        // Kyunki library yeh sirf tab karti hai jab config mein number pehle se ho.
        try {
            await client.pupPage.exposeFunction('onCodeReceivedEvent', (code) => {
                // Jab browser code generate karega, wo yahan aayega
                return code;
            });
        } catch (e) {
            // Agar function pehle se exposed hai to error ignore karo
        }
        // --- FIX END ---

        const code = await client.requestPairingCode(cleanNumber);
        return code;
    } catch (error) {
        console.error('Pairing Code Error:', error);
        throw error;
    }
};

// Baaki file waisi hi rahegi. Make sure 'requestPairingCode' exports mein added ho.
module.exports = { initialize, sendMessage, getStatus, requestPairingCode };