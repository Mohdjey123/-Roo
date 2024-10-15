const { search } = require('./indexer'); // Import the search function from indexer

// Function to handle search requests
async function handleSearch(query) {
    // Validate the query
    if (!query || query.trim() === "") {
        return { error: 'Query parameter is required' };
    }

    // Search the index for the given query
    const results = await search(query);

    // Return the results
    return { query, results };
}

module.exports = { handleSearch };
