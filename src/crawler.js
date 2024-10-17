const axios = require('axios');
const cheerio = require('cheerio');
const { addToIndex, saveIndex, addLink } = require('./indexer.js');
const urlParser = require('url');
const cliProgress = require('cli-progress');

const crawledUrls = new Set();
const urlQueue = [];

async function crawlPage(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'RooBot/1.0 (https://github.com/Mohdjey123/RooSearch)'
            },
            timeout: 10000
        });
        const html = response.data;
        const $ = cheerio.load(html);

        // Remove unwanted elements
        $('nav, header, footer, script, style').remove();
        $('button, .btn, [role="button"]').remove();

        // Extract text from the main content area
        let text = '';
        $('article, main, #content, .content, .main-content').each((i, elem) => {
            text += $(elem).text() + ' ';
        });

        // If no main content area is found, fall back to body text
        if (!text.trim()) {
            text = $('body').text();
        }

        const links = [];
        $('a').each((i, element) => {
            const href = $(element).attr('href');
            if (href) {
                const fullUrl = new URL(href, url).href;
                if (fullUrl.startsWith('http')) {
                    links.push(fullUrl);
                    addLink(url, fullUrl);
                }
            }
        });

        return { text: text.trim(), links, url };
    } catch (error) {
        console.error(`Error crawling ${url}:`, error.message);
        return null;
    }
}

async function crawl(seedUrls, maxPages = 10000, concurrency = 5) {
    if (!Array.isArray(seedUrls)) {
        console.error('seedUrls must be an array');
        return;
    }

    urlQueue.push(...seedUrls);

    const progressBar = new cliProgress.SingleBar({
        format: 'Crawling Progress |{bar}| {percentage}% | ETA: {eta}s | {value}/{total} pages',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
    });

    progressBar.start(maxPages, 0);

    const startTime = Date.now();

    async function processBatch() {
        const batch = urlQueue.splice(0, concurrency);
        const promises = batch.map(async (url) => {
            if (crawledUrls.has(url)) {
                return;
            }

            const pageData = await crawlPage(url);

            if (pageData) {
                crawledUrls.add(url);
                await addToIndex(pageData.text, url);

                for (const link of pageData.links) {
                    if (!crawledUrls.has(link) && !urlQueue.includes(link)) {
                        urlQueue.push(link);
                    }
                }

                progressBar.increment();
            }

            // Add a short delay between crawls
            await new Promise(resolve => setTimeout(resolve, 500));
        });

        await Promise.all(promises);
    }

    let lastSaveTime = Date.now();
    const saveInterval = 5 * 60 * 1000; // 5 minutes

    while (urlQueue.length > 0 && crawledUrls.size < maxPages) {
        await processBatch();

        // Save index periodically
        if (Date.now() - lastSaveTime > saveInterval) {
            await saveIndex();
            lastSaveTime = Date.now();
        }
    }

    progressBar.stop();

    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000; // in seconds

    console.log(`\nCrawl completed. Crawled ${crawledUrls.size} pages in ${totalTime.toFixed(2)} seconds.`);
    await saveIndex();
}

module.exports = { crawl, crawlPage, crawledUrls, urlQueue };
