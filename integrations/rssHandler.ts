// rss dependencies
import RSS from "rss";

// http server dependencies
import { BaseHandler, GetContentHeaders } from './tcpServer';
import fs from 'fs';
import path from 'path';
import url from 'url';


const RSS_FILE_DIR = path.join(__dirname.replace("integrations", ""), 'rss'); // Directory to stored game files

// a http server handler for our rss implementation 
// handles some http GET requests for the RSS/[feed].xml objects. 
// handles post requests for adding new RSS feeds. 
export class RSSHandler extends BaseHandler {
    rssFeeds;
    constructor() {
        super();
        this.rssFeeds = {};
        // !! this should probably load in the existing RSS feeds from the 'RSS_FILE_DIR' location
    }

    // sends the rss/feed.xml file back 
    HandleGet(client) {
        const rssFilePath = path.join(RSS_FILE_DIR, client.url.pathname.replace(`/rss/`, "")); // Remove leading "/rss/"
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
                client.SendResponse(400, "error");
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
        const title = data.title;
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
        const title = feedOptions.title;
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
