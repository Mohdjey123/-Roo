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

       // Store compressed snippet for the URL
       const snippet = words.slice(0, 30).join(' ');
       const compressedSnippet = await compress(Buffer.from(snippet));
       index[url] = { compressedSnippet: compressedSnippet.toString('base64'), wordCount: words.length };

       console.log(`Indexed ${uniqueWordsIndexed} unique words from ${url}`);
   } catch (error) {
       console.error(`Error indexing content from ${url}:`, error.message);
   }
}

async function search(query) {
    const queryTerms = tokenize(query.toLowerCase());
    console.log('Query terms:', queryTerms);
    console.log('Index keys:', Object.keys(index));
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
            let snippet = "No snippet available.";
            if (index[url] && index[url].compressedSnippet) {
                try {
                    const compressedBuffer = Buffer.from(index[url].compressedSnippet, 'base64');
                    snippet = (await decompress(compressedBuffer)).toString();
                } catch (error) {
                    console.error(`Error decompressing snippet for ${url}:`, error.message);
                }
            }
            return {
                url,
                score: data.score,
                positions: data.positions,
                snippet: snippet
            };
        }));

    console.log(`Searching for "${query}", found ${sortedResults.length} results`);
    return sortedResults;
}

async function saveIndex() {
    try {
        const indexString = JSON.stringify(index);
        console.log('Index before saving:', index);
        const compressedIndex = await compress(Buffer.from(indexString));
        await fs.writeFile(indexFilePath, compressedIndex);
        console.log('Compressed index saved to file');
    } catch (error) {
        console.error('Error saving index:', error.message);
    }
}

async function loadIndex() {
    try {
        const compressedData = await fs.readFile(indexFilePath);
        const decompressedData = await decompress(compressedData);
        const indexData = JSON.parse(decompressedData.toString());
        Object.assign(index, indexData);
        console.log('Index loaded successfully');
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
