"use strict"
console.log("starting... RSS Server")


// http server dependencies  
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// rss dependencies
const RSS = require("rss");
const { debug } = require('console');



const PORT = 8000;
const WEBSITE_FILE_DIR = path.join(__dirname, 'website'); // Directory to stored game files
const RSS_FILE_DIR = path.join(__dirname, 'rss'); // Directory to stored game files




const contexts = {};
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




//#region additional server functionality
// adds a way to search for and find a matching context within the defined context dictionary 
server.findContext = function findContext(target) {
    var closestMatch = 0;
    var closestVal = 100000;
    var currentVal;

    var contextKeys = Object.keys(contexts);
    for (let i = 0; i < contextKeys.length; i++) {
        currentVal = levenshtein(target, contextKeys[i]);
        //console.log("testing: ", target ,"against", contextKeys[i], "result", currentVal); 
        if (currentVal < closestVal) {
            closestMatch = i;
            closestVal = currentVal;
        }
        if (closestVal == 0)
            break;
    }
    //console.log("closest context with val: ",  closestVal, contextKeys[closestMatch]); 
    return Object.values(contexts)[closestMatch];

    // function to find closest matching string 
    function levenshtein(a, b) {
        // 
        if (a === b) return 0;
        if (!a.startsWith(b))
            return 100000;
        // should have already filtered out most case by here. 
        const matrix = Array(a.length + 1)
            .fill(null)
            .map(() => Array(b.length + 1).fill(null));

        for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
        for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,    // Deletion
                    matrix[i][j - 1] + 1,    // Insertion
                    matrix[i - 1][j - 1] + cost // Substitution
                );
            }
        }
        return matrix[a.length][b.length];
    }
}
server.GetContentHeaders = (target) => {
    if (!target)
        return { 'Content-Type': 'text/plain' };

    let match = target.match(/\.[\w.]+$/)[0]; // gets the file extention matches extentions with 2 "." just need to add it as a case
    //console.log(match);
    switch (match) {
        case ".html": return { 'Content-Type': 'text/html; charset=UTF-8' };
        case ".css": return { 'Content-Type': 'text/css' };
        case ".ico": return { 'Content-Type': 'image' };
        case ".png": return { 'Content-Type': 'image/png' };
        case ".jpg": return { 'Content-Type': 'image/jpg' };
        case ".webp": return { 'Content-Type': 'image/webp' };
        case ".js": return { 'Content-Type': 'application/javascript' };
        case ".xml": return { 'Content-Type': 'application/xml' };
        case ".mp3": return { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable', };
        default: return { 'Content-Type': 'text/plain' };
    }
}
//#endregion






// a reprentation of a user/client.Request can be passed through the diffent methods.
// contains the http request and response objects to comunicate back to the client, in adition to some functionality to simplify basic responses. 
class TcpClient {
    constructor(req, res) {
        this.req = req; //request data 
        this.res = res; //response endpoint to finish the message
        this.url = url.parse(req.url, true);
    }

    SendResponse(code, data, headers) {
        if (!headers)
            headers = server.GetContentHeaders();
        this.res.writeHead(code, headers);
        this.res.end(data);
    }

    SendFile(filePath) {
        console.log("sending file", filePath);
        fs.readFile(filePath, function NormalFile(err, data) {
            if (err) {
                this.SendResponse(404, 'File not found');
                console.log("couldn't find file: ", filePath);
            } else {
                this.SendResponse(200, data, server.GetContentHeaders(filePath));
                console.log("sent file: ", filePath, "with headers", server.GetContentHeaders(filePath));
            }
        }.bind(this));
    }
}


// barebones handler, extend from this for new contexts/applications
class BaseHandler {
    // gives some handles to override in the subclasses
    Handle(client) {
        switch (client.req.method) {
            case 'GET':
                this.HandleGet(client);
                break;
            case 'POST':
                // waits till we have all the data concatinated before calling handlePost 
                client.body = '';
                client.req.on('data', chunk => client.body += chunk);
                client.req.on('end', function () { this.HandlePost(client) }.bind(this));
                break;
            default:
                this.HandleExceptions(client);
                break;
        }
    }

    // overrideable functions for the subsclasses 
    HandleGet(client) {
        console.error("'HandleGet' not implemented for", this.constructor.name);
        client.SendResponse(405, 'Method Not Allowed');
    }
    HandlePost(client) {
        console.error("'HandlePost' not implemented for", this.constructor.name);
        client.SendResponse(405, 'Method Not Allowed');
    }
    HandleExceptions(client) {
        console.log("couldn't handle", req.method);
        client.SendResponse(405, 'Method Not Allowed');
    }
}






// the simplified http file server, on a get request finds the file 
// (access limited to the website_file_dir, with access to all the subfiles via their path in the request url)
class FileHandler extends BaseHandler {
    HandleGet(client) {
        const filePath = path.join(WEBSITE_FILE_DIR, client.url.pathname.substring(1)); // Remove leading "/"
        client.SendFile(filePath);
    }
}








// a http server handler for our rss implementation 
// handles some http GET requests for the RSS/[feed].xml objects. 
// handles post requests for adding new RSS feeds. 
class RSSHandler extends BaseHandler {
    constructor() {
        super();
        this.rssFeeds = {};
        // !! this should probably load in the existing RSS feeds from the 'RSS_FILE_DIR' location
    }

    // sends the rss/feed.xml file back 
    HandleGet(client) {
        const rssFilePath = path.join(RSS_FILE_DIR, parsedUrl.pathname.replace(`/rss/`, "")); // Remove leading "/rss/"
        client.SendFile(rssFilePath);
        return;
    }
    // HANDLE POSTING TO THE RSS FEED 
    HandlePost(client) {
        // once at the end of the post body, parse it to an object 
        var data = JSON.parse(client.body);
        console.log("got data:", data);
        // adds the sender so we can referance it later if needed for a reply. 

        // if it has a request type try match the request type
        switch (data["type"]) {
            case "createRSS":
                this.CreateRSS(client, data);
                break;
            default:
                this.SendResponse(400, server.GetContentHeaders(), "error");
                break;
        }
    }



    CreateRSS(client, reqData) {
        // validates their is request data
        var data = reqData["data"];
        if (!data)
            return { error: `no data in reqData["data"] ` };

        // pulls the origin from the sender (passed into the reqData obj earlier)
        const origin = client.req.headers.origin;
        console.log(origin);
        var rssFilePath = path.join(RSS_FILE_DIR, data["feed_url"].replace(`${origin}/rss/`, "")); // Remove leading "[http://localhost:8000]/rss/"

        // tries to create a new feed. is one already exists this will return null/undefined
        const title = feedOptions.title;
        if (this.rssFeeds[title]) {
            console.log(`feed ${title} already exists`);
            client.SendResponse(400, `failed to create rss: file already exists`);
            return;
        }
        else {
            var rssFeed = this.CreateNewFeed(data);
            // writes the new rss feed object to file '.xml' format
            fs.writeFile(`${rssFilePath}`, rssFeed.xml(), (err) => { if (err) { console.error(err); } });
            client.SendResponse(200, "success");
        }
    }


    CreateNewFeed(feedOptions) {
        var feed = new RSS(feedOptions); // creates the feed 
        this.rssFeeds[title] = feed; // adds the feed to the feeds object 

        console.log(`added new rssFeed ${title}`);
        return feed;
    }
}

/*
feedOptions = {
    title:              string Title of your site or feed
    description:        optional string A short description of the feed.
    generator:          optional string Feed generator.
    feed_url:           url string Url to the rss feed.
    site_url:           url string Url to the site that the feed is for.
    image_url:          optional url string Small image for feed readers to use.
    docs:               optional url string Url to documentation on this feed.
    managingEditor:     optional string Who manages content in this feed.
    webMaster:          optional string Who manages feed availability and technical support.
    copyright:          optional string Copyright information for this feed.
    language:           optional string The language of the content of this feed.
    categories:         optional array of strings One or more categories this feed belongs to.
    pubDate:            optional Date object or date string The publication date for content in the feed
    ttl:                optional integer Number of minutes feed can be cached before refreshing from source.
    hub:                optional PubSubHubbub hub url Where is the PubSubHub hub located.
    custom_namespaces:  optional object Put additional namespaces in element (without 'xmlns:' prefix)
    custom_elements:    optional array Put additional elements in the feed (node-xml syntax)
}
*/
