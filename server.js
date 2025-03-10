"use strict"
console.log("starting... RSS Server")


// http server dependencies  
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');


// adds intergration contexts
const {BaseHandler, TcpClient, AddContextHandlingToServer, contexts} = require('./integrations/tcpServer.js');
const {RSSHandler} = require('./integrations/rssHandler.js');


const PORT = 8000;
const WEBSITE_FILE_DIR = path.join(__dirname, 'website'); // Directory to stored game files




// starts the http server
const server = http.createServer(function handleServerRequests(req, res) {
    // handles the server requests, finds the closest matching context class instance from 'contexts' and uses it to handle the server
    console.log("new http request... ")
    var client = new TcpClient(req, res);
    var context = server.findContext(client.url.pathname);
    context.Handle(client);
});
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/index.html`);
    // adds contexts to handle the different request types. 
    contexts["/rss"] = new RSSHandler();
    contexts["/"] = new FileHandler();
});
console.log("Started file server");

AddContextHandlingToServer(server); 


// the simplified http file server, on a get request finds the file 
// (access limited to the website_file_dir, with access to all the subfiles via their path in the request url)
class FileHandler extends BaseHandler {
    HandleGet(client) {
        const filePath = path.join(WEBSITE_FILE_DIR, client.url.pathname.substring(1)); // Remove leading "/"
        client.SendFile(filePath);
    }
}