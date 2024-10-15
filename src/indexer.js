const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const indexFilePath = path.join(__dirname, '../data/index.json');

// Define the in-memory index
const index = {};

// Add text to the index, handling potential errors
async function addToIndex(text, url) {
   try {
       const words = tokenize(text);
       const phraseLength = 3;
       const phrases = [];

       // Index individual words and phrases
       for (let i = 0; i < words.length; i++) {
           const word = words[i].toLowerCase();
           if (!isStopWord(word)) {
               if (!index[word]) {
                   index[word] = [];
               }
               index[word].push({ url, position: i });
           }

           if (i + phraseLength <= words.length) {
               const phrase = words.slice(i, i + phraseLength).join(' ').toLowerCase();
               if (!index[phrase]) {
                   index[phrase] = [];
               }
               index[phrase].push({ url, position: i });
               phrases.push(phrase);
           }
       }

       // Store or update snippet for the URL
       const snippet = words.slice(0, 20).join(' ');
       const compressedSnippet = await gzip(snippet);
       if (!index[url]) {
           index[url] = { compressedSnippet, wordCount: words.length };
       } else {
           index[url].wordCount += words.length;
           // Optionally update snippet if this one is longer
           if (snippet.length > (await gunzip(index[url].compressedSnippet)).length) {
               index[url].compressedSnippet = compressedSnippet;
           }
       }

       console.log(`Indexed ${words.length} words and ${phrases.length} phrases from ${url}`);
   } catch (error) {
       console.error(`Error indexing content from ${url}:`, error.message);
   }
}

async function search(query) {
   const queryTerms = tokenize(query.toLowerCase());
   const results = {};

   for (const term of queryTerms) {
       if (index[term]) {
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
       .map(async ([url, data]) => ({
           url,
           score: data.score,
           positions: data.positions,
           snippet: index[url] ? await gunzip(index[url].compressedSnippet) : "No snippet available"
       })));

   console.log(`Searching for "${query}", found ${sortedResults.length} results`);
   return sortedResults;
}

// Save the index to a file
async function saveIndex() {
    fs.writeFileSync(indexFilePath, JSON.stringify(index));
    console.log('Index saved to file');
}

// Load the index from a file
async function loadIndex() {
    if (fs.existsSync(indexFilePath)) {
        try {
            const data = fs.readFileSync(indexFilePath, 'utf8');
            Object.assign(index, JSON.parse(data));
            console.log('Index loaded successfully');
        } catch (error) {
            console.error('Error loading index:', error.message);
            console.log('Starting with an empty index.');
        }
    } else {
        console.log('No existing index file found. Starting with an empty index.');
    }
}

// Helper functions
function tokenize(text) {
    return text.toLowerCase().split(/\W+/).filter(word => word.length > 0);
}

function isStopWord(word) {
    const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'for', 'to', 'of', 'and', 'or', 'but']);
    return stopWords.has(word);
}

module.exports = { addToIndex, search, saveIndex, loadIndex };
