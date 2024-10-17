const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const util = require('util');

const compress = util.promisify(zlib.brotliCompress);
const decompress = util.promisify(zlib.brotliDecompress);

const indexFilePath = path.join(__dirname, '../data/index.br');

// Define the in-memory index structures
const invertedIndex = {};
const urlToContent = {};
const pageRank = {};
const incomingLinks = {};

async function addToIndex(text, url) {
   try {
       const words = tokenize(text);
       const wordSet = new Set(words);

       urlToContent[url] = await compress(Buffer.from(text));

       wordSet.forEach(word => {
           if (!isStopWord(word)) {
               if (!invertedIndex[word]) {
                   invertedIndex[word] = new Set();
               }
               invertedIndex[word].add(url);
           }
       });

       // Initialize PageRank
       if (!pageRank[url]) {
           pageRank[url] = 1.0;
       }

       console.log(`Indexed ${wordSet.size} unique words from ${url}`);
   } catch (error) {
       console.error(`Error indexing content from ${url}:`, error.message);
   }
}

function addLink(fromUrl, toUrl) {
    if (!incomingLinks[toUrl]) {
        incomingLinks[toUrl] = new Set();
    }
    incomingLinks[toUrl].add(fromUrl);
}

function calculatePageRank(iterations = 20, dampingFactor = 0.85) {
    const urls = Object.keys(pageRank);
    const n = urls.length;

    for (let i = 0; i < iterations; i++) {
        const newRanks = {};
        for (const url of urls) {
            let sum = 0;
            for (const incomingUrl of (incomingLinks[url] || [])) {
                sum += pageRank[incomingUrl] / (incomingLinks[incomingUrl] || []).size;
            }
            newRanks[url] = (1 - dampingFactor) / n + dampingFactor * sum;
        }
        Object.assign(pageRank, newRanks);
    }
}

function getSnippet(text, query, snippetLength = 20) {
    const words = text.split(/\s+/);
    const queryWords = query.toLowerCase().split(/\s+/);
    
    // Find positions of the query words in the text
    const positions = words.reduce((acc, word, index) => {
        if (queryWords.some(qw => word.toLowerCase().includes(qw))) {
            acc.push(index);
        }
        return acc;
    }, []);

    if (positions.length > 0) {
        // Find the best snippet that includes the most query words
        let bestStart = 0;
        let bestScore = 0;

        for (let i = 0; i < positions.length; i++) {
            const start = Math.max(0, positions[i] - Math.floor(snippetLength / 2));
            const end = Math.min(words.length, start + snippetLength);
            const snippet = words.slice(start, end);
            const score = queryWords.filter(qw => 
                snippet.some(sw => sw.toLowerCase().includes(qw))
            ).length;

            if (score > bestScore) {
                bestScore = score;
                bestStart = start;
            }
        }

        const start = bestStart;
        const end = Math.min(words.length, start + snippetLength);
        const snippet = words.slice(start, end);

        // Create an array of [word, shouldHighlight] pairs
        const highlightedSnippet = snippet.map(word => [
            word,
            queryWords.some(qw => word.toLowerCase().includes(qw))
        ]);

        return {
            snippet: highlightedSnippet,
            ellipsis: end < words.length
        };
    }

    return null; // Return null if no snippet can be created
}

async function search(query, page = 1, resultsPerPage = 10) {
    const queryTerms = tokenize(query.toLowerCase());
    console.log('Query terms:', queryTerms);
    const results = {};

    // Use the inverted index for faster lookups
    for (const term of queryTerms) {
        if (isStopWord(term)) continue;

        const urls = invertedIndex[term] || new Set();
        for (const url of urls) {
            if (!results[url]) {
                results[url] = { score: 0, termFrequency: {} };
            }
            results[url].score += pageRank[url] || 1;
            results[url].termFrequency[term] = (results[url].termFrequency[term] || 0) + 1;
        }
    }

    // Calculate TF-IDF scores
    const idf = {};
    const N = Object.keys(urlToContent).length;
    for (const term of queryTerms) {
        if (isStopWord(term)) continue;
        const df = (invertedIndex[term] || new Set()).size;
        idf[term] = Math.log(N / (df + 1));
    }

    for (const url in results) {
        let tfidfScore = 0;
        for (const term in results[url].termFrequency) {
            const tf = results[url].termFrequency[term];
            tfidfScore += tf * idf[term];
        }
        results[url].score *= (1 + tfidfScore);
    }

    const sortedResults = Object.entries(results)
        .sort((a, b) => b[1].score - a[1].score);

    const totalResults = sortedResults.length;
    const totalPages = Math.ceil(totalResults / resultsPerPage);
    const startIndex = (page - 1) * resultsPerPage;
    const endIndex = startIndex + resultsPerPage;

    const paginatedResults = await Promise.all(sortedResults.slice(startIndex, endIndex)
        .map(async ([url, data]) => {
            if (!urlToContent[url]) {
                console.error(`Missing compressed text for URL: ${url}`);
                return {
                    url,
                    score: data.score,
                    snippet: [["Snippet unavailable (missing compressed text)", false]],
                    ellipsis: false
                };
            }
            try {
                const decompressedText = (await decompress(Buffer.from(urlToContent[url]))).toString();
                const snippetData = getSnippet(decompressedText, query);
                return {
                    url,
                    score: data.score,
                    snippet: snippetData ? snippetData.snippet : [["No relevant snippet found", false]],
                    ellipsis: snippetData ? snippetData.ellipsis : false
                };
            } catch (error) {
                console.error(`Error decompressing text for ${url}:`, error.message);
                return {
                    url,
                    score: data.score,
                    snippet: [[`Snippet unavailable (decompression error: ${error.message})`, false]],
                    ellipsis: false
                };
            }
        }));

    console.log(`Searching for "${query}", found ${totalResults} results, showing page ${page} of ${totalPages}`);
    return {
        results: paginatedResults,
        totalResults,
        currentPage: page,
        totalPages
    };
}

async function saveIndex() {
    try {
        console.log('Preparing to save index...');
        const data = {
            invertedIndex: Object.fromEntries(Object.entries(invertedIndex).map(([k, v]) => [k, Array.from(v)])),
            urlToContent: Object.fromEntries(Object.entries(urlToContent).map(([k, v]) => [k, v.toString('base64')])),
            pageRank,
            incomingLinks: Object.fromEntries(Object.entries(incomingLinks).map(([k, v]) => [k, Array.from(v)]))
        };
        const indexString = JSON.stringify(data);
        console.log(`Index size before compression: ${indexString.length} bytes`);
        const compressedIndex = await compress(Buffer.from(indexString));
        console.log(`Compressed index size: ${compressedIndex.length} bytes`);
        await fs.writeFile(indexFilePath, compressedIndex);
        console.log('Compressed index saved to file');
    } catch (error) {
        console.error('Error saving index:', error.message);
    }
}

async function loadIndex() {
    try {
        console.log('Loading index from file...');
        const compressedData = await fs.readFile(indexFilePath);
        console.log(`Read ${compressedData.length} bytes of compressed data`);
        const decompressedData = await decompress(compressedData);
        console.log(`Decompressed data size: ${decompressedData.length} bytes`);
        const { invertedIndex: loadedIndex, urlToContent: loadedContent, pageRank: loadedPageRank, incomingLinks: loadedIncomingLinks } = JSON.parse(decompressedData.toString());
        
        Object.entries(loadedIndex).forEach(([word, urls]) => {
            invertedIndex[word] = new Set(urls);
        });
        Object.entries(loadedContent).forEach(([url, content]) => {
            urlToContent[url] = Buffer.from(content, 'base64');
        });
        Object.assign(pageRank, loadedPageRank);
        Object.entries(loadedIncomingLinks).forEach(([url, links]) => {
            incomingLinks[url] = new Set(links);
        });

        console.log('Index loaded successfully');
        console.log(`Loaded ${Object.keys(invertedIndex).length} words and ${Object.keys(urlToContent).length} URLs into the index`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('No existing index file found. Starting with an empty index.');
        } else {
            console.error('Error loading index from file:', error.message);
            console.log('Starting with an empty index.');
        }
    }
}

function tokenize(text) {
    return text.toLowerCase().split(/\W+/).filter(word => word.length > 0);
}

function isStopWord(word) {
    const stopWords = new Set([
        'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
        'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
        'can\'t', 'cannot', 'could', 'couldn\'t',
        'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during',
        'each',
        'few', 'for', 'from', 'further',
        'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s',
        'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself',
        'let\'s',
        'me', 'more', 'most', 'mustn\'t', 'my', 'myself',
        'no', 'nor', 'not',
        'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
        'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
        'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
        'under', 'until', 'up',
        'very',
        'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t',
        'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
    ]);
    return stopWords.has(word.toLowerCase());
}

function getIndexStats() {
    return {
        totalEntries: Object.keys(invertedIndex).length + Object.keys(urlToContent).length,
        wordEntries: Object.keys(invertedIndex).length,
        urlEntries: Object.keys(urlToContent).length
    };
}

module.exports = { addToIndex, search, saveIndex, loadIndex, addLink, calculatePageRank, getIndexStats };
