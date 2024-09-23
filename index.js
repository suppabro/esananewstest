const pino = require('pino');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { esana_latest_news_id, esana_latest_id } = require('esana-news.js');
const { MongoClient } = require('mongodb');

// MongoDB setup
const mongoUri = 'mongodb+srv://esana:ztE49AXAm!YFw6_@cluster1.kpjy4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1';  // Replace with your MongoDB URI
const client = new MongoClient(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

// Baileys WhatsApp setup
const { state, saveState } = useSingleFileAuthState('./session/baileys_auth_info.json');

async function run() {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db('esana-news');
    const collection = db.collection('latest-news');

    const session = makeWASocket({
        logger: pino({ level: 'debug' }),
        printQRInTerminal: true, // This prints the QR code for you to scan
        auth: state,
        version: [2, 2140, 12], // Make sure this version is compatible
    });

    session.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            console.log('Connection closed, reconnecting...');
            run(); // Reconnect
        }
    });

    session.ev.on('creds.update', saveState);

    // News fetching loop
    async function fetchLatestNews() {
        const latestNews = await esana_latest_news_id();  // Fetch news
        console.log('Latest news:', latestNews);

        // Save the news to MongoDB
        await collection.insertOne({
            id: latestNews.id,
            title: latestNews.title,
            url: latestNews.url,
            date: new Date(),
        });
    }

    setInterval(fetchLatestNews, 3600000); // Fetch news every hour
}

run().catch(console.error);
