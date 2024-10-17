const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const util = require('util');

const compress = util.promisify(zlib.brotliCompress);
const decompress = util.promisify(zlib.brotliDecompress);

const indexFilePath = path.join(__dirname, '../data/index.br');

// Define the in-memory index
const index = {};

async function addToIndex(text, url) {
   try {
       const words = tokenize(text);
       const wordSet = new Set(words);
       let uniqueWordsIndexed = 0;

       for (const word of wordSet) {
           if (!isStopWord(word)) {
               if (!index[word]) {
                   index[word] = [];
               }
               index[word].push({ url, position: words.indexOf(word) });
               uniqueWordsIndexed++;
           }
       }

       // Compress and store the full text
       const compressedText = await compress(Buffer.from(text));
       if (!index[url]) {
           index[url] = {};
       }
       index[url].compressedText = compressedText;
       index[url].wordCount = words.length;

       console.log(`Indexed ${uniqueWordsIndexed} unique words from ${url}`);
       console.log(`Compressed text length for ${url}: ${compressedText.length} bytes`);
   } catch (error) {
       console.error(`Error indexing content from ${url}:`, error.message);
   }
}

function getSnippet(text, query, snippetLength = 20) {
    const words = text.split(/\s+/);
    const queryLower = query.toLowerCase();
    
    // Find positions of the query in the text
    const positions = words.reduce((acc, word, index) => {
        if (word.toLowerCase().includes(queryLower)) {
            acc.push(index);
        }
        return acc;
    }, []);

    if (positions.length > 0) {
        // Create a snippet based on the first occurrence
        const start = Math.max(0, positions[0] - Math.floor(snippetLength / 2));
        const end = Math.min(words.length, start + snippetLength);
        return {
            snippet: words.slice(start, end).join(' '),
            positions: positions.filter(pos => pos >= start && pos < end).map(pos => pos - start)
        };
    }

    return null; // Return null if no snippet can be created
}

async function search(query) {
    const queryTerms = tokenize(query.toLowerCase());
    console.log('Query terms:', queryTerms);
    const results = {};

    for (const term of queryTerms) {
        if (isStopWord(term)) continue;  // Skip stop words in the query

        if (index[term] && Array.isArray(index[term])) {
            for (const entry of index[term]) {
                if (!results[entry.url]) {
                    results[entry.url] = { score: 0, positions: [] };
                }
                results[entry.url].score++;
                results[entry.url].positions.push(entry.position);
            }
        }
    }

    const sortedResults = await Promise.all(Object.entries(results)
        .sort((a, b) => b[1].score - a[1].score)
        .map(async ([url, data]) => {
            if (!index[url]) {
                console.error(`Missing index entry for URL: ${url}`);
                return {
                    url,
                    score: data.score,
                    positions: data.positions,
                    snippet: "Snippet unavailable (missing index entry)",
                    snippetPositions: []
                };
            }
            if (!index[url].compressedText) {
                console.error(`Missing compressed text for URL: ${url}`);
                return {
                    url,
                    score: data.score,
                    positions: data.positions,
                    snippet: "Snippet unavailable (missing compressed text)",
                    snippetPositions: []
                };
            }
            try {
                const decompressedText = (await decompress(index[url].compressedText)).toString();
                console.log(`Decompressed text length for ${url}: ${decompressedText.length} characters`);
                const snippetData = getSnippet(decompressedText, query);
                if (!snippetData) {
                    console.log(`No relevant snippet found for ${url}`);
                }
                return {
                    url,
                    score: data.score,
                    positions: data.positions,
                    snippet: snippetData ? snippetData.snippet : "No relevant snippet found",
                    snippetPositions: snippetData ? snippetData.positions : []
                };
            } catch (error) {
                console.error(`Error decompressing text for ${url}:`, error.message);
                return {
                    url,
                    score: data.score,
                    positions: data.positions,
                    snippet: `Snippet unavailable (decompression error: ${error.message})`,
                    snippetPositions: []
                };
            }
        }));

    console.log(`Searching for "${query}", found ${sortedResults.length} results`);
    return sortedResults;
}

async function saveIndex() {
    try {
        console.log('Preparing to save index...');
        // Convert Buffer objects to base64 strings for JSON serialization
        const serializableIndex = Object.fromEntries(
            Object.entries(index).map(([key, value]) => [
                key,
                typeof value === 'object' && value.compressedText
                    ? { ...value, compressedText: value.compressedText.toString('base64') }
                    : value
            ])
        );
        const indexString = JSON.stringify(serializableIndex);
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
        const indexData = JSON.parse(decompressedData.toString());
        // Convert base64 strings back to Buffer objects
        Object.entries(indexData).forEach(([key, value]) => {
            if (typeof value === 'object' && value.compressedText) {
                value.compressedText = Buffer.from(value.compressedText, 'base64');
            }
        });
        Object.assign(index, indexData);
        console.log('Index loaded successfully');
        console.log(`Loaded ${Object.keys(index).length} entries into the index`);
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

module.exports = { addToIndex, search, saveIndex, loadIndex, index };
