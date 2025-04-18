import fs from 'fs';
import url from 'url';
import https from 'https';
import { IncomingMessage, ServerResponse } from 'http';

// server.contexts are added to this
export const contexts = {};

// searches the contexts keys to find the closest matching value, required to completely match the context string. 
export function findContext(target): BaseHandler {
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
    return Object.values(contexts)[closestMatch] as BaseHandler;

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


// uses a switch statement to return the correct headers based on the targets file extention eg: .png
export function GetContentHeaders(target = ""): object {
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

// a reprentation of a user/client.Request can be passed through the diffent methods.
// contains the http request and response objects to comunicate back to the client, in adition to some functionality to simplify basic responses. 
export class TcpClient {

    req; //request data 
    res; //response endpoint to finish the message
    url;
    queries;

    body;// text version of post request body
    data;// json version of post request body

    constructor(req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
        this.req = req; //request data 
        this.res = res; //response endpoint to finish the message
        this.url = url.parse(req.url, true);
        this.queries = this.url.query;
    }


    SendResponse(code: Number, data, headers = undefined) {
        if (!headers)
            headers = GetContentHeaders();
        this.res.writeHead(code, headers);
        if (typeof data === 'object' && !(data instanceof Buffer || data instanceof Uint8Array))
            data = JSON.stringify(data);
        this.res.end(data);
    }

    SendFile(filePath: string) {
        console.log("sending file", filePath);
        fs.readFile(filePath, function NormalFile(err, data) {
            if (err) {
                this.SendResponse(404, 'File not found');
                console.log("couldn't find file: ", filePath);
            } else {
                this.SendResponse(200, data, GetContentHeaders(filePath));
                console.log("sent file: ", filePath, "with headers", GetContentHeaders(filePath));
            }
        }.bind(this));
    }
}


// barebones handler, extend from this for new contexts/applications
export class BaseHandler {
    // gives some handles to override in the subclasses
    Handle(client: TcpClient): void {
        try {
            switch (client.req.method) {
                case 'GET':
                    this.HandleGet(client);
                    break;
                case 'POST':
                    // waits till we have all the data concatinated before calling handlePost 
                    client.body = '';
                    client.req.on('data', chunk => client.body += chunk);
                    client.req.on('end', function () {
                        client.data = JSON.parse(client.body);
                        this.HandlePost(client);
                    }.bind(this));
                    break;
                default:
                    this.HandleExceptions(client);
                    break;
            }
        } catch (e) {
            console.error(e);
            client.res
        }
    }

    // overrideable functions for the subsclasses 
    HandleGet(client: TcpClient): void {
        console.error("'HandleGet' not implemented for", this.constructor.name);
        client.SendResponse(405, 'Method Not Allowed');
    }
    HandlePost(client: TcpClient): void {
        console.error("'HandlePost' not implemented for", this.constructor.name);
        client.SendResponse(405, 'Method Not Allowed');
    }
    HandleExceptions(client: TcpClient): void {
        console.log("couldn't handle", client.req.method);
        client.SendResponse(405, 'Method Not Allowed');
    }
}