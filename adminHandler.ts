import { BaseHandler, TcpClient } from "./integrations/tcpServer";


var adminDetails : { [key: string]: object } = {}; // a list of {key:openid , data:{data}}
var activeAdmins : { [key: string]: Admin } = {} ; // a list of {key: openid, admin:Admin}


// this will be where we manage admin signin, admin controls etc 
export class AdminHandler extends BaseHandler {
    constructor() {
        super();
        this.Instantiate();
    }

    async Instantiate() {
        // pull admin details from file. 
        // does nothing with them. 

    }

    HandlePost(client: TcpClient): void {
        //handle admin login request
    
        const pathname = client.url.pathname.replace('/admin/', '');
        switch (pathname) {
            case "login":
                 this.attemptLogin(client);
            break; 
        }
    }

    attemptLogin(client : TcpClient){
        // uses openid or something to match the details of the client to an admin within the list
        // looks through the admin details list and pulls the associated data to then contstruct an Admin instance
        // from there we could either establish a socket connection to handle future requests or do some sort of session token, that our handlePost function can use to find and pass on to the correct admin 
    }
}

class Admin{


}