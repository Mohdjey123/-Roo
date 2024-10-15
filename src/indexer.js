const fs = require('fs');
const path = require('path');
const zstd = require('node-zstandard');

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
       const snippet = words.slice(0, 30).join(' '); // Increased to 30 words for a longer snippet
       const compressedSnippet = await zstd.compress(Buffer.from(snippet));
       if (!index[url]) {
           index[url] = { compressedSnippet, wordCount: words.length };
       } else {
           index[url].wordCount += words.length;
           index[url].compressedSnippet = compressedSnippet; // Always update the snippet
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
       .map(async ([url, data]) => {
           let snippet = "No snippet available.";
           if (index[url] && index[url].compressedSnippet) {
               try {
                   snippet = (await zstd.decompress(index[url].compressedSnippet)).toString();
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

// Save the index to a file
async function saveIndex() {
    try {
        const compressedIndex = await zstd.compress(Buffer.from(JSON.stringify(index)));
        fs.writeFileSync(indexFilePath, compressedIndex);
        console.log('Compressed index saved to file');
    } catch (error) {
        console.error('Error saving index:', error.message);
    }
}

// Load the index from a file
async function loadIndex() {
   if (fs.existsSync(indexFilePath)) {
       try {
           const compressedData = fs.readFileSync(indexFilePath);
           const data = await zstd.decompress(compressedData);
           if (data.length === 0) {
               console.log('Index file is empty. Starting with an empty index.');
           } else {
               Object.assign(index, JSON.parse(data.toString()));
               console.log('Index loaded successfully');
           }
       } catch (error) {
           console.error('Error loading index from file:', error.message);
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

module.exports = { addToIndex, search, saveIndex, loadIndex, index };
