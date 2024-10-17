const { search, getRandomPages } = require('./indexer.js');

async function handleSearch(query, page = 1, resultsPerPage = 10) {
    if (!query || query.trim() === "") {
        // Feeling lucky: return random pages
        const randomUrls = getRandomPages(resultsPerPage);
        const results = await Promise.all(randomUrls.map(async (url) => {
            return {
                url,
                score: 1,  // Arbitrary score for random results
                snippet: [["Random result (feeling lucky)", false]],
                ellipsis: false
            };
        }));

        return {
            query: "Feeling Lucky",
            results,
            totalResults: results.length,
            currentPage: 1,
            totalPages: 1
        };
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
