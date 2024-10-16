# RooSearch

RooSearch is a lightweight, open-source search engine designed to crawl and index web pages. It allows for searching indexed content and provides basic web crawling capabilities. 

## Features
- **Crawling**: Crawls web pages and extracts text and links.
- **Indexing**: Stores crawled content for efficient searching.
- **Search**: Enables searching the indexed content with a simple keyword-based search.
- **Automatic Crawling**: Supports automatic crawling with predefined seed URLs.
- **Web Interface**: Provides a basic web interface to interact with the search engine.

## Getting Started

### Prerequisites

Make sure you have the following installed:
- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Mohdjey123/RooSearch.git
   cd RooSearch
1. **Install dependencies**
   ```bash
    npm install
1. **Start the server**
   ```bash
    node server.js
    The server will run on http://localhost:3000.

### Usage

**Web Interface**
1. Open a web browser and go to http://localhost:3000.
1. Use the search bar to find indexed content.
1. View the crawling status by navigating to /status.
   
**API Endpoints**

- GET /search?q=<query>: Searches for the given query in the indexed content.
- GET /crawl?url=<url>: Crawls the specified URL and adds it to the index.
- GET /view-index: Returns the current in-memory index.
- GET /crawl-status: Provides the crawling status, including the number of crawled URLs and the queue length.
- GET /status: Displays the current server status.
  
**Configuration**
  
Modify the server and crawler settings in server.js and crawler.js as needed:
- Port: Change the port in server.js.
- Seed URLs and max pages: Configure these in server.js for automatic crawling.
  
**Project Structure**
  
- crawler.js: Handles web crawling and extracting content.
- indexer.js: Manages indexing, saving, and loading the search index.
- search.js: Implements the search functionality and result processing.
- server.js: The main server script that integrates all components and provides the web interface.

**Example**

To start a crawl with automatic seeding:
1. Start the server:
    ```bash
    node --watch server.js
1. Automatic crawling will begin with predefined seed URLs, or you can manually crawl new URLs via the /crawl endpoint.
   
**Dependencies**

- axios: For HTTP requests.
- cheerio: For parsing HTML content.
- express: Web server framework.
- zlib: Compression utilities for indexing.
- fs: File system operations.

**Contributing**

Contributions are welcome! Please submit a pull request or open an issue to discuss improvements.

**License**

This project is open-source under the MIT License. 
This `README.md` file provides an overview of the RooSearch project, setup instructions, and usage details.
