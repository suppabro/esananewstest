const Esana = require('esana-news-scraper'); // Import the Esana scraper
const mongoose = require('mongoose');
const pino = require("pino");
const { useMultiFileAuthState, makeWASocket, fetchLatestBaileysVersion, makeInMemoryStore } = require("@whiskeysockets/baileys");

// MongoDB schema for storing news information
const UserSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    newsid: { type: String }, // For tracking the last sent news
});

const news1 = mongoose.model("news1", UserSchema); // Define the news model

async function XAsena() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb+srv://esana:ztE49AXAm!YFw6_@cluster1.kpjy4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1');
        console.log('Connected to MongoDB');

        // Set up multi-file auth state (this saves session data)
        const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/session');
        const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });
        const { version } = await fetchLatestBaileysVersion();

        // Initialize WhatsApp Web socket
        const session = makeWASocket({
            logger: pino({ level: 'fatal' }),   // Set logging level
            printQRInTerminal: true,            // Ensure QR code is printed in the terminal
            auth: state,                        // Reuse saved session
            version: version,
            browser: ['EsanaNewsBot', 'Safari', '1.0.0'],  // Bot metadata
        });

        // Bind the event store
        store.bind(session.ev);

        // Listen for connection updates
        session.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === "open") {
                console.log('Connection opened, starting news fetch loop');

                // Initialize Esana scraper
                var api = new Esana();

                // Variable to store the ID of the last news sent
                let lastNewsId = null;

                // Define callback function for new news
                var callback = async (full_news) => {
                    try {
                        // Check if the current news is new (compare news ID)
                        if (full_news.id !== lastNewsId) {
                            // Format the news message
                            let mg = `*${full_news.title}*
●━━━━━━━━━━━━━━━━━━━━━●
\`\`\`${full_news.desc}\`\`\`
●━━━━━━━━━━━━━━━━━━━━━●
${full_news.time}

📡 Source - Esana 
   𝙱𝙾𝚃𝙺𝙸𝙽𝙶𝙳𝙾𝙼 

●━━━━━━━━━━━━━━━━━━━━━●`;

                            let newss = await news1.findOne({ id: '123' });

                            if (!newss) {
                                await new news1({ id: '123', newsid: full_news.id, events: 'true' }).save();
                            } else {
                                await news1.updateOne({ id: '123' }, { newsid: full_news.id, events: 'true' });
                            }

                            console.log('Sending message to all groups');
                            const groups = await session.groupFetchAllParticipating();
                            const groupIds = Object.keys(groups);

                            // Send the news message to all groups
                            for (const id of groupIds) {
                                console.log(`Sending message to group: ${id}`);
                                await sendMessageWithRetry(session, id, { image: { url: full_news.image }, caption: mg });
                            }

                            // Update lastNewsId to the current news ID after sending it
                            lastNewsId = full_news.id;
                        } else {
                            console.log('Same news as last time, skipping sending.');
                        }
                    } catch (err) {
                        console.error('Error in sending news:', err);
                    }
                };

                // Set interval for fetching news every 60 seconds
                var ms = 60 * 1000; // 60 seconds

                // Start the news loop
                await api.news_loop(callback, ms);
            }

            // Handle reconnection if session closes
            if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                console.log('Connection closed, reconnecting...');
                XAsena();
            }
        });

        // Save credentials when they are updated
        session.ev.on('creds.update', saveCreds);

    } catch (err) {
        console.error('An error occurred:', err);
    }
}

// Retry function to handle message sending failures
async function sendMessageWithRetry(session, jid, message, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await session.sendMessage(jid, message);
            console.log('Message sent successfully');
            return;
        } catch (err) {
            console.error(`Failed to send message on attempt ${i + 1}:`, err);
            if (i === retries - 1) {
                console.error('Max retries reached, giving up');
            } else {
                console.log('Retrying...');
            }
        }
    }
}

// Start the bot
XAsena();
