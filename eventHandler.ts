import path from "path";
import fs from 'fs';
import { BaseHandler, TcpClient } from "./integrations/tcpServer";

const BOILERPLATE_DIR = path.join(__dirname, 'integrations/sharedpageboilerplate.html');
const SHARED_LINK_DIR = path.join(__dirname, 'shared_links'); // Directory to stored game files

let boilerPlateHtml: string;
let ActivityType: Array<string>;





export class EventHandler extends BaseHandler {
    constructor() {
        super();
        this.Initialise();
    }
    // reads in the boilerplate for the event pages intended
    async Initialise() {
        console.log(BOILERPLATE_DIR);
        boilerPlateHtml = fs.readFileSync(BOILERPLATE_DIR).toString();
    }

    HandleGet(client: TcpClient): void {
        // handles getting the link html files for sharing links
        const filePath = path.join(SHARED_LINK_DIR, client.url.pathname.replace("/event", ""));  // Remove leading "/event"
        console.log("\n", filePath);
        client.SendFile(filePath);
    }

    HandlePost(client: TcpClient): void {
        const data = client.data;
        // allows the creation of events to be shared to everything
        console.log("Event Handler handling Event post");
        var event = new Event(data["title"] || "default event title", []);
        event.sendToRecipents("");
    }
}





// the different types of activities. 
/* 
    an event contains a list of recipents/ intended target audiences, ie: insitute, priesthood, relief society. 
    which in turn contain a list of all the destinations:  instagram/ facebook, calendar, other attached info for the assigned audience. 
    
    when sharing the event it will look through these for all the unique destinations, and send the event link in the assicosiated format.
    each recipiant will have its own rss feed. 
*/

export class Event {
    recipients: Array<Recipent>;

    name: string;
    admins: Array<string>; // a list of email addresses, will compare against an openid request before making any changes to this.   
    constructor(name: string, recipients: Array<Recipent>) {
        this.name = name;
        this.recipients = recipients;
    }


    sendToRecipents(senderOpenID) {
        let completed = [];


        this.recipients.forEach(recipent => {
            recipent.destinations.forEach(destination => {

                completed.push(destination["id"]); // !! not implemented
                destination; 
            });
        });


    }

    static fromFile() {
        // adds from file to this. activities. 
        //this.activities; 
    }
    static toFile() {
        //var str = JSON.stringify();
        // write to file. 
    }


    static GenerateEventSharePage(data) {
        const renderHTML = (template: string, data: Record<string, string>) => {
            return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || "");
        };

        const output = renderHTML(boilerPlateHtml, data);
        fs.writeFile("", output, (e) => {
            console.log(e);
        });

        /*
           title
           date 
           eventImagePath
           shareLink
           subscribeLink
           description
        */
    }
}





// holds the destinations as well as the info required to set them up. 
export class Recipent {
    destinations: Array<object>;
    constructor(destinations?: Array<object>) {
        // takes in a list of {type:instagram,username:jacob, sub:main-page } assigned to this recipient
        this.destinations = destinations;

    }
}   