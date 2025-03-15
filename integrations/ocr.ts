import Tesseract from 'tesseract.js';
import path from 'path';


import { BaseHandler, GetContentHeaders, TcpClient } from './tcpServer';
import fs from 'fs';
import url from 'url';

// Path to the image file
const imagePath = path.join(__dirname, 'test.png');







export class OCRHandler extends BaseHandler{
    HandleGet(client: TcpClient) {
    
        var response = this.GetTextFromImage(imagePath); 
        response.then(text => client.SendResponse(200, `ocrHandler ${text}`));
    }

    async HandlePost(client: TcpClient) {
        /*
            client.data = {
                image: <buffer> image...
            }
        */


        // uses the url as the file name, makes sure its a legit file path
        var url = client.url.pathname; 
        console.log(url);
        if(!url.endsWith(".png")){
            client.SendResponse(200, `ocrHandler post requires a .png format`);
            return;    
        }
        // gets the full filepath __dirname is the directory of this file
        var imagePath = path.join(__dirname, url);

        // waits for fs to write the file to the filepath, then ocr's the text, then responds to the client with the text. 
        var base64String = client.data["image"]; 
        const buffer = Buffer.from(base64String, 'base64');
        //console.log(image);

        new Promise((resolve)=> { fs.writeFile(imagePath, buffer, resolve);  })
        .then(()=> this.GetTextFromImage(imagePath))
        .then(text => client.SendResponse(200, {response:text}))
        .catch(exception => {
            console.error(exception); 
            client.SendResponse(200, {response:`ocrHandler error, ${JSON.stringify(exception)}`});
        });
    }



    GetTextFromImage(imagePath){
        return Tesseract.recognize(
            imagePath,               // Image file path
            'eng',                   // Language (English in this case)
            {
                logger: m => console.log(m) // Log progress
            }
        ).then(({ data: { text } }) => {
            console.log('Recognized text:', text);
            return text; 
        }).catch(error => {
            console.error('Error:', error);
        });
    }
} 

