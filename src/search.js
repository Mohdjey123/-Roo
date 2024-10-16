const { index, search } = require('./indexer.js');

async function handleSearch(query) {
    if (!query || query.trim() === "") {
        return { error: 'Query parameter is required' };
    }

    console.log(`Searching for "${query}"`);
    const results = await search(query);
    console.log(`Found ${results.length} results`);

    return { query, results };
}

module.exports = { handleSearch };
