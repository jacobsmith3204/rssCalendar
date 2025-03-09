"use strict"
console.log("starting... RSS Server")


// http server dependencies  
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// rss dependencies
const RSS = require("rss");



const PORT = 8000;
const WEBSITE_FILE_DIR = path.join(__dirname, 'website'); // Directory to stored game files
const RSS_FILE_DIR = path.join(__dirname, 'rss'); // Directory to stored game files





// starts a simple file server
const server = http.createServer(handleFileServerRequests);
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/index.html`);
});
console.log("Started file server");





// handles the file server requests
function handleFileServerRequests(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const filePath = path.join(WEBSITE_FILE_DIR, parsedUrl.pathname.substring(1)); // Remove leading "/"
    // 
    switch (req.method) {
        case 'GET':
            HandleGet();
            break;
        case 'POST':
            HandlePost();
            break;
        default:
            HandleExceptions();
            break;
    }


    // 
    function HandleGet() {
        console.log("using method: ", req.method);

        if(req.url.startsWith("/rss/"))
        {
            const rssFilePath = path.join(RSS_FILE_DIR, parsedUrl.pathname.replace(`/rss/`, "")); // Remove leading "/rss/"
            fs.readFile(rssFilePath, function RSSFile(err, data) {
                if (err) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('File not found');
                    console.log("couldn't find file: ", filePath);
                } else {
                    res.writeHead(200, GetContentHeaders(filePath));
                    res.end(data);
                    console.log("sent file: ", filePath, "with headers", GetContentHeaders(filePath));
                }
            });
            return;
        }

        fs.readFile(filePath, function NormalFile(err, data) {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File not found');
                console.log("couldn't find file: ", filePath);
            } else {
                res.writeHead(200, GetContentHeaders(filePath));
                res.end(data);
                console.log("sent file: ", filePath, "with headers", GetContentHeaders(filePath));
            }
        });
    }


    // 
    function HandleExceptions() {
        console.log("couldn't handle", req.method);
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
    }
    // 
    function HandlePost() {

        // HANDLE POSTING TO THE RSS FEED 

        // collects packets in their chunks, concatenates into body 
        let body = '';
        req.on('data', chunk => {
            body += chunk;
        });


        
        req.on('end', () => {
            // once at the end of the post body, parse it to an object 
            var data = JSON.parse(body);
            console.log("got data:", data);
            // adds the sender so we can referance it later if needed for a reply. 
            data["sender"] = req;
            
            // if it has a request type try match the request type
            switch (data["type"]) {
                case "createRSS":
                    var response = CreateRSS(data);
                    if(!response.error)
                        respondWithMessage("completed");
                    else
                        respondWithError(`failed to create rss ${response.error}`);
                    break;
                default:
                    respondWithError("error");
                    break;
            }
        });
    }





    // enables response wtih post requests 
    function respondWithMessage(message) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(message);
    }
    function respondWithError(message) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`error: ${message}`);
    }

    // helper function to send the right response headers based on the content's file extention 
    function GetContentHeaders(target) {
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
            case ".xml": return {'Content-Type': 'application/xml'};
            case ".mp3": return { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable', };
            default: return { 'Content-Type': 'text/plain' };
        }
    }
}






function CreateRSS(reqData){
    var data = reqData["data"]; 


    if(!data)
        return {error: `no data in reqData["data"] `}; 

    // pulls the origin from the sender (passed into the reqData obj earlier)
    const origin = reqData.sender.headers.origin; 
    console.log(origin);
    var rssFilePath = path.join(RSS_FILE_DIR, data["feed_url"].replace(`${origin}/rss/`, "")); // Remove leading "[http://localhost:8000]/rss/"
    var rssFeed; 

    if(rssFeed = CreateNewFeed(data)){
        fs.writeFile(`${rssFilePath}`, rssFeed.xml() , (err)=> { if(err){console.error(err);} }); 
        return {message:"success"};
    }
    else {
        return {error: `file may already exist`};  
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


const rssFeeds = {};

function CreateNewFeed(feedOptions) {

    const title = feedOptions.title; 
    if(rssFeeds[title]){
        console.log(`feed ${title} already exists`); 
        return;
    }
    var feed = new RSS(feedOptions);
    rssFeeds[title] = feed;

    console.log(`added new rssFeed ${title} `); 
    return feed; 
    
}