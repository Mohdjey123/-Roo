// src/server.js
const express = require('express');
const path = require('path'); // Import path module
const { crawl, crawlPage, crawledUrls, urlQueue } = require('./crawler.js');
const { addToIndex, saveIndex, loadIndex, index } = require('./indexer.js');
const { handleSearch } = require('./search.js');

const app = express();
const PORT = 3000;

// Load the index if it exists
loadIndex();

// Serve static files from the public directory
app.use(express.static('public'));

// Serve the index.html file at the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/html/index.html')); // Use path.join for better path handling
});

// Endpoint to crawl a page and add to index
app.get('/crawl', async (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).send('URL parameter is required');
    }
    
    const content = await crawlPage(url);
    if (content) {
        await addToIndex(content.text, url);
        await saveIndex(); // Save index after adding new content
        res.send(`Crawled: ${url}`);
    } else {
        res.status(500).send('Failed to crawl the page');
    }
});

// Endpoint to start a crawl
app.get('/start-crawl', async (req, res) => {
    const startUrl = req.query.url;
    const maxPages = parseInt(req.query.maxPages) || 10;
    if (!startUrl) {
        return res.status(400).send('URL parameter is required');
    }
    
    res.send(`Starting crawl from ${startUrl}`);
    
    // Start the crawl process
    await crawl(startUrl, maxPages);
    await saveIndex(); // Save index after crawling
});

// Search endpoint
app.get('/search', async (req, res) => {
    const query = req.query.q;
    const searchResults = await handleSearch(query);
    if (searchResults.error) {
        return res.status(400).send(searchResults.error);
    }
    
    res.json(searchResults);
});

// Endpoint to get crawl status
app.get('/crawl-status', (req, res) => {
    res.json({
        crawledUrls: Array.from(crawledUrls),
        queueLength: urlQueue.length,
        indexSize: Object.keys(index).length
    });
});

// Status endpoint
app.get('/status', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/html/status.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Roo search engine running on http://localhost:${PORT}`);
});
