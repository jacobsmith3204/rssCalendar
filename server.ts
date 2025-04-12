"use strict"
console.log("starting... RSS Server")


// http server dependencies  
import https from 'https';
import fs from 'fs';
import path from 'path';
import url from 'url';

// adds integration contexts
import { BaseHandler, TcpClient, findContext, contexts } from './integrations/tcpServer';
import { RSSHandler } from './integrations/rssHandler';
import { CalendarHandler } from './integrations/googleCalendarHandler';
import { InstagramHandler } from './integrations/instagramHandler';
import { OCRHandler } from './integrations/ocr';
import { EventHandler } from './integrations/eventHandler';
import { OauthHandler } from './integrations/oauthHandler';
//import { Initialise as InitialiseAdminOauth } from './admin';

const PORT = 8000;
const WEBSITE_FILE_DIR = path.join(__dirname, 'website'); // Directory to stored game files
const SERVER_CERT_DIR = process.env.SERVER_CERT_DIR; // Directory to stored game files
const SERVER_KEY_DIR = process.env.SERVER_KEY_DIR; // Directory to stored game files

// server options (reads from key/cert files)
const options = {
    key: fs.readFileSync(SERVER_KEY_DIR), // Private key
    cert: fs.readFileSync(SERVER_CERT_DIR) // Certificate
};

// starts the http server
const server = https.createServer(options, function handleServerRequests(req, res) {
    // handles the server requests, finds the closest matching context class instance from 'contexts' and uses it to handle the server
    console.log("new http request... ")
    var client = new TcpClient(req, res);
    var context = findContext(client.url.pathname);
    context.Handle(client);
});


server.listen(PORT, () => {
    console.log(`Server running at https://localhost:${PORT}/index.html`);
    // adds contexts to handle the different request types. 
    contexts["/oauth"] = new OauthHandler(); 
    contexts["/rss"] = new RSSHandler();
    contexts["/calendar"] = new CalendarHandler();
    contexts["/"] = new FileHandler();
    contexts["/instagram"] = new InstagramHandler(); 
    contexts["/ocr"] = new OCRHandler(); 
    contexts["/event"] = new EventHandler(); 
   
});

console.log("Started file server");

// the simplified http file server, on a get request finds the file 
// (access limited to the website_file_dir, with access to all the subfiles via their path in the request url)
class FileHandler extends BaseHandler {
    HandleGet(client: TcpClient): void {
        const filePath = path.join(WEBSITE_FILE_DIR, client.url.pathname.substring(1)); // Remove leading "/"
        client.SendFile(filePath);
    }
}
