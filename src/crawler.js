const axios = require('axios');
const cheerio = require('cheerio');

async function crawlPage(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        // Extract text content from the body
        return $('body').text();
    } catch (error) {
        console.error(`Error crawling ${url}:`, error.message);
        return null;
    }
}

module.exports = { crawlPage };
