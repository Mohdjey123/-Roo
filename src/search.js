const { search } = require('./indexer.js');

async function handleSearch(query, page = 1, resultsPerPage = 10) {
    if (!query || query.trim() === "") {
        return { error: 'Query parameter is required' };
    }

    console.log(`Searching for "${query}" (Page ${page})`);
    const searchResults = await search(query, page, resultsPerPage);
    console.log(`Found ${searchResults.totalResults} results, showing page ${page} of ${searchResults.totalPages}`);

    return { 
        query, 
        ...searchResults
    };
}

module.exports = { handleSearch };
