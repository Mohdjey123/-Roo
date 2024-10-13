const express = require('express');
const path = require('path'); // Import path to handle file paths
const { crawlPage } = require('./crawler');
const { addToIndex, saveIndex, loadIndex } = require('./indexer');
const { handleSearch } = require('./search');

const app = express();
const PORT = 3000;

// Load the index if it exists
loadIndex();

// Serve static files (HTML, CSS, etc.)
app.use(express.static(path.join(__dirname, '../public'))); // Serve files from the 'public' directory

// Endpoint to crawl a page and add to index
app.get('/crawl', async (req, res) => {
   const url = req.query.url;
   if (!url) {
       return res.status(400).send('URL parameter is required');
   }
   
   const content = await crawlPage(url);
   if (content) {
       addToIndex(content, url);
       saveIndex(); // Save index after adding new content
       res.send(`Crawled: ${url}`);
   } else {
       res.status(500).send('Failed to crawl the page');
   }
});

// Set up the search endpoint using the search.js module
app.get('/search', (req, res) => {
   const query = req.query.q;
   const searchResults = handleSearch(query); // Use the search handler
   if (searchResults.error) {
       return res.status(400).send(searchResults.error);
   }
   
   res.json(searchResults); // Send back the search results
});

// Add a route for the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/html/index.html')); // Serve the HTML file
});

// Start the server
app.listen(PORT, () => {
    console.log(`Roo search engine running on http://localhost:${PORT}`);
});
