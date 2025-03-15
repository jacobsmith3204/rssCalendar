// http server dependencies
import { BaseHandler, GetContentHeaders, TcpClient } from './tcpServer';
import fs from 'fs';
import path, { resolve } from 'path';
import url from 'url';
import { IgApiClient } from 'instagram-private-api';

const IG_USERNAME = process.env.IG_USERNAME as string;
const IG_PASSWORD = process.env.IG_PASSWORD as string;


export class InstagramHandler extends BaseHandler {
    constructor() {
        super();

    }
    //
    HandleGet(client: TcpClient) {
        this.PostToInstagram(client);
    }
    HandlePost(client: TcpClient) {

    }
    // 


    async PostToInstagram(client: TcpClient) {
        // login 

        console.log("posting to instagram");
        const ig = new IgApiClient();
        ig.state.generateDevice(IG_USERNAME);
        await ig.account.login(IG_USERNAME, IG_PASSWORD);



        //client.data["file"]
        // get image
        console.log("fetching to instagram");

        var imageBuffer; 

        await new Promise<void>(resolve =>
            fs.readFile(path.join(__dirname, 'test.png'), (err, data) => {
                if (err) throw err;
                console.log(data);
                imageBuffer = data; 
                resolve();
            }
        ));



        //await fetch('https://i.imgur.com/BZBHsauh.jpg').then(data=> imageBuffer = data );


        // post
        console.log("publishing to instagram", imageBuffer);
        await ig.publish.photo({
            file: imageBuffer,
            caption: 'Really nice photo from the internet!', // nice caption (optional)
        });
        // responding to client
        client.SendResponse(200, "completed instagram post");
    }
}