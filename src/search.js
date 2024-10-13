// search.js
const { search } = require('./indexer');

// Function to handle search requests
function handleSearch(query) {
    if (!query) {
        return { error: 'Query parameter is required' };
    }

    const results = search(query);

    // Format results as needed, e.g., grouping by URL
    const groupedResults = results.reduce((acc, { url, position }) => {
        if (!acc[url]) {
            acc[url] = [];
        }
        acc[url].push(position); // Add positions to the corresponding URL
        return acc;
    }, {});

    return { query, results: groupedResults };
}

module.exports = { handleSearch };
