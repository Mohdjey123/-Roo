const { index } = require('./indexer.js');
const zlib = require('zlib');

async function search(query) {
    console.log('Current index:', JSON.stringify(index, null, 2));
    console.log(`Searching for "${query}" in index with ${Object.keys(index).length} entries`);

    const results = [];
    for (const [url, data] of Object.entries(index)) {
        if (!data || !data.text) {
            console.warn(`Invalid data for URL ${url}:`, data);
            continue;
        }
        if (data.text.toLowerCase().includes(query.toLowerCase())) {
            results.push({ url, text: data.text });
        }
    }
    return results;
}

function getSnippet(text, query) {
    console.log(`Getting snippet for query: "${query}"`);
    console.log(`Text type: ${typeof text}, length: ${text ? text.length : 'N/A'}`);

    if (!text) {
        console.warn('Text is empty or undefined');
        return 'Snippet unavailable';
    }

    // Simple snippet extraction (you may want to improve this)
    const lowerText = text.toLowerCase();
    const index = lowerText.indexOf(query.toLowerCase());
    let snippet = text.slice(Math.max(0, index - 50), Math.min(text.length, index + 50));

    console.log(`Extracted snippet: "${snippet}"`);

    return snippet;
}

async function handleSearch(query) {
    if (!query || query.trim() === "") {
        return { error: 'Query parameter is required' };
    }

    console.log(`Searching for "${query}"`);
    const results = await search(query);
    console.log(`Found ${results.length} results`);

    // Process snippets
    const processedResults = results.map(result => {
        console.log(`Processing result for URL: ${result.url}`);
        const snippet = getSnippet(result.text, query);
        return { ...result, snippet };
    });

    return { query, results: processedResults };
}

module.exports = { handleSearch, getSnippet, search };
