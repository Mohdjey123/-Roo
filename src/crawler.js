const axios = require('axios');
const cheerio = require('cheerio');
const urlParser = require('url');
const { addToIndex } = require('./indexer');

// Set to store already crawled URLs
const crawledUrls = new Set();

// Queue to store URLs to be crawled
const urlQueue = [];

// Function to crawl a single page
async function crawlPage(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'WEBBO 1.0'
            },
            timeout: 10000 // 10 seconds timeout
        });
        
        if (response.status !== 200) {
            console.error(`Failed to retrieve ${url}: Status ${response.status}`);
            return null;
        }

        const $ = cheerio.load(response.data);
        
        // Remove unwanted elements
        $('script, style, nav, footer, header, aside').remove(); 
        
        const text = $('body')
            .find('p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, div')
            .map((_, element) => $(element).text().trim())
            .get()
            .join('\n')
            .replace(/\s+/g, ' ')
            .trim();
        
        const title = $('title').text().trim();
        const metaDescription = $('meta[name="description"]').attr('content');
        const links = $('a').map((_, element) => $(element).attr('href')).get();

        return { 
            url,
            title, 
            text,
            metaDescription,
            links
        };
    } catch (error) {
        console.error(`Error crawling ${url}:`, error.message);
        return null;
    }
}

// Function to normalize and filter URLs
function normalizeUrl(baseUrl, url) {
    const parsedUrl = urlParser.parse(url);
    if (!parsedUrl.protocol) {
        return urlParser.resolve(baseUrl, url);
    }
    return url;
}

// Main crawling function
async function crawl(startUrl, maxPages = 10) {
    urlQueue.push(startUrl);
    
    while (urlQueue.length > 0 && crawledUrls.size < maxPages) {
        const currentUrl = urlQueue.shift();
        
        if (crawledUrls.has(currentUrl)) {
            continue;
        }
        
        console.log(`Crawling: ${currentUrl}`);
        const pageData = await crawlPage(currentUrl);
        
        if (pageData) {
            crawledUrls.add(currentUrl);
            
            // Process the page data (e.g., add to index)
            await addToIndex(pageData.text, pageData.url);
            
            // Add new URLs to the queue
            pageData.links.forEach(link => {
                const normalizedUrl = normalizeUrl(currentUrl, link);
                if (normalizedUrl.startsWith('http') && !crawledUrls.has(normalizedUrl)) {
                    urlQueue.push(normalizedUrl);
                }
            });
        }
    }
    
    console.log(`Crawling complete. Crawled ${crawledUrls.size} pages.`);
}

module.exports = { crawl, crawlPage };
