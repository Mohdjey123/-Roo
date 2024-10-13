const { crawlPage } = require('./crawler');
const { addToIndex, search } = require('./indexer');

async function testRoo() {
    const url = 'https://example.com';
    const content = await crawlPage(url);
    if (content) {
        addToIndex(content, url);
    }

    // Test searching
    const query = 'example';
    const results = search(query);
    console.log(`Results for "${query}":`, results);
}

testRoo();
