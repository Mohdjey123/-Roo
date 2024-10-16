const axios = require('axios');
const cheerio = require('cheerio');
const { addToIndex, saveIndex, index } = require('./indexer.js');
const urlParser = require('url');

// Set to store already crawled URLs
const crawledUrls = new Set();

// Queue to store URLs to be crawled
const urlQueue = [];

// Function to crawl a single page
async function crawlPage(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'RooBot/1.0 (https://github.com/Mohdjey123/RooSearch)'
            },
            timeout: 10000 // 10 seconds timeout
        });
        const html = response.data;
        const $ = cheerio.load(html);

        // Extract text content
        const text = $('body').text();

        // Extract links
        const links = [];
        $('a').each((i, element) => {
            const href = $(element).attr('href');
            if (href) {
                const fullUrl = new URL(href, url).href;
                if (fullUrl.startsWith('http')) {
                    links.push(fullUrl);
                }
            }
        });

        return { text, links, url };
    } catch (error) {
        console.error(`Error crawling ${url}:`, error.message);
        return null;
    }
}

// Main crawling function
async function crawl(seedUrls, maxPages = 50) {
    if (!Array.isArray(seedUrls)) {
        console.error('seedUrls must be an array');
        return;
    }

    urlQueue.push(...seedUrls);

    while (urlQueue.length > 0 && crawledUrls.size < maxPages) {
        const url = urlQueue.shift();
        if (crawledUrls.has(url) || index[url]) {
            continue;
        }

        console.log(`Crawling: ${url}`);
        const pageData = await crawlPage(url);

        if (pageData) {
            crawledUrls.add(url);
            await addToIndex(pageData.text, url);
            console.log(`Successfully crawled and indexed: ${url}`);
            console.log(`Text length: ${pageData.text.length} characters`);
            console.log(`Found ${pageData.links.length} links`);

            for (const link of pageData.links) {
                if (!crawledUrls.has(link) && !urlQueue.includes(link) && !index[link]) {
                    urlQueue.push(link);
                }
            }
        }

        // Add a delay to be respectful to servers
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Crawl completed. Crawled ${crawledUrls.size} pages.`);
    await saveIndex();
}

module.exports = { crawl, crawlPage, crawledUrls, urlQueue };
