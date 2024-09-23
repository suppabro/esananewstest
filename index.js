const pino = require('pino');
const makeWASocket = require('@whiskeysockets/baileys').default;
const Parser = require('rss-parser');
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
        version: [2, 2140, 12], // Ensure this version is compatible
    });

    session.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            console.log('Connection closed, reconnecting...');
            run(); // Reconnect
        }
    });

    session.ev.on('creds.update', saveState);

    // RSS news fetching loop
    const parser = new Parser();
    async function fetchLatestNews() {
        const feed = await parser.parseURL('https://news.google.com/rss');  // Replace with your preferred RSS feed
        const latestNews = feed.items[0];  // Get the latest news article
        console.log('Latest news:', latestNews.title);

        // Save the news to MongoDB
        await collection.insertOne({
            title: latestNews.title,
            link: latestNews.link,
            pubDate: latestNews.pubDate,
            date: new Date(),
        });
    }

    setInterval(fetchLatestNews, 3600000); // Fetch news every hour
}

run().catch(console.error);
