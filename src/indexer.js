const fs = require('fs');
const path = require('path');
const indexFilePath = path.join(__dirname, '../data/index.json');

// Define the in-memory index
const index = {};

// Add text to the index
function addToIndex(text, url) {
    const words = text.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
        const word = words[i].toLowerCase();
        if (!index[word]) {
            index[word] = [];
        }
        // Store the URL and the position of the word
        index[word].push({ url, position: i });
    }
}

// Search for a word in the index
function search(query) {
    const results = index[query.toLowerCase()] || [];
    
    // Map results to format with unique URLs and their respective positions
    return results.map(entry => ({
        url: entry.url,
        position: entry.position
    }));
}

// Save the index to a file
function saveIndex() {
    fs.writeFileSync(indexFilePath, JSON.stringify(index, null, 2));
    console.log('Index saved to file');
}

// Load the index from a file
function loadIndex() {
   if (fs.existsSync(indexFilePath)) {
       try {
           const data = fs.readFileSync(indexFilePath, 'utf8');
           if (data.trim() === "") {
               console.log('Index file is empty. Starting with an empty index.');
           } else {
               Object.assign(index, JSON.parse(data));
               console.log('Index loaded from file');
           }
       } catch (error) {
           console.error('Error loading index from file:', error.message);
           console.log('Starting with an empty index.');
       }
   } else {
       console.log('No existing index file found');
   }
}


module.exports = { addToIndex, search, saveIndex, loadIndex };
