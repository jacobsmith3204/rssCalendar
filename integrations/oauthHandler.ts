import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { BaseHandler, TcpClient, GetContentHeaders } from './tcpServer';
import path from 'path';
import fs from 'fs';

const API_KEY = process.env.GOOGLE_CALENDAR_API_KEY;
const CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;

const REDIRECT_URL = "https://localhost:8000/oauth/oauthcallback";
const LOGINS_PATH = path.join(__dirname.replace('integrations', ''), "/hidden/logins.json");
const FORCE_CONSENT_PROMPT = true;

export var logins = {};




export function GetOAuthClient() {
    // returns a new oauthclient
    const oauth = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
    oauth.forceRefreshOnFailure = true;
    return oauth;
}
export async function refreshAccessToken(oauthClient: OAuth2Client, token) {
    oauthClient.setCredentials(token);
    try {
        const { token } = await oauthClient.getAccessToken();
        oauthClient.setCredentials({ access_token: token });
        //console.log("new access token:", token);
        return token;
    }
    catch (e) {
        console.error("ERROR:", e);
        return undefined;
    }
}



export class OauthHandler extends BaseHandler {

    constructor(){
        super();
        this.Initialise();
    }

    async Initialise() {
        await LoadAllClientLoginsFromFile();
        //console.log(logins);
    }

    HandleGet(client: TcpClient) {

        const pathname = client.url.pathname.replace('/oauth/', '');
        switch (pathname) {
            case 'startoauth':
                client.SendResponse(200, { oauthurl: this.generateLoginURL() });
                break;
            case 'oauthcallback':
                this.HandleOauthCallback(client);
                break;
            case 'validatelastloginid':
                client.SendResponse(200, { response: (logins[client.queries["id"]]) ? 'successful' : 'unsuccessful' });
                break;
            default:
                console.error(`calendarHandler GET: couldn't find pathname ${pathname}`);
                client.SendResponse(500, "couldnt find correct action");
                break;
        }
    }

    
      generateLoginURL() {
        const scope = [
          'https://www.googleapis.com/auth/calendar', // allows access to the calendar api
          "openid", // allows access to open id for getting the users email etc for server side auto-verification
        ];
        const opts = { access_type: "offline", scope: scope }; // "offline" Required for refresh tokens 
        if (FORCE_CONSENT_PROMPT)
          opts["prompt"] = "consent"; // forces asking for user consent (usually only happens the first time)
    
        const oauth2Client = GetOAuthClient(); 
        const authUrl = oauth2Client.generateAuthUrl(opts);
        console.log("Authorize this app by visiting this URL:", authUrl);
        return authUrl;
      }
    
    
    
      //when the google authentication is complete it will send a get request to the REDIRECT_URL (assuming its whitelisted)
      async HandleOauthCallback(client: TcpClient) {
        // sends back a webpage/(the onSucess text as a webpage) which then sends some data back to the original webpage(window.opener)
        console.log("using context oauthcallback, found queries:", JSON.stringify(client.queries));
    
        // uses the code to setup the oauth credentials 
        const code = client.queries["code"];
        if (!code) return;
    
        try {
          // uses the callback code as a key to fetch the oauth tokens from google
          // then uses the returned tokens to set the credentials 
          const oauth2Client = GetOAuthClient();
          var { tokens } = await oauth2Client.getToken(code);
          oauth2Client.setCredentials(tokens);
          
          console.log("oauth got tokens", tokens);

          // if we find a refresh token (only provided when logging on the first time, or explicitly requested) 
          // grabs the user data to find an id then add it to the logins object
          if (tokens.refresh_token) {
            console.log("New Refresh Token:", tokens.refresh_token, "\n adding token ");
    
            // gets the users data and creates a new calendar client for this users id. 
            const userData = await getUserInfo(oauth2Client);
            console.log(`\n\n user data was:`, userData);
            AddNewUserInfo(userData.id, tokens);
            client.SendResponse(200, onSuccess(userData.id), GetContentHeaders(".html"))
            return
          }
          else {
            console.log("New Access Token:", tokens.access_token);
            client.SendResponse(500, "ERROR OCCURED HANDLING OAUTH CALLBACK");
            // if its not a refresh token, then we can't get the user id,
          }
    
          // A PSUDO webpage that before it closes posts a success message back to the page that opened it, then promptly closes
          function onSuccess(id, action = "view") {
            return `<!DOCTYPE html><html><body><h1> success </h1><script>
                  window.onbeforeunload = () => {
                    window.opener.postMessage('{"type": "oauth successful", "id": "${id}", "action":"${action}"}' , "*");
                  };
                  window.close();  
                  </script></body></html>`
          }
        }
        catch (e) {
          console.error(e);
        }
      }
    
}







export async function getUserInfo(oauthClient : OAuth2Client) {
    // Ensure the client has a valid access
    console.log("\n\n GET USER INFO, CHECKING CREDENTIALS: ", oauthClient.credentials);

    const oauth2 = google.oauth2({
        auth: oauthClient,
        version: 'v2',
    });

    const res = await oauth2.userinfo.get();
    console.log("User Info:", res.data);
    return res.data; // Returns email, ID, name, etc.
}

export async function AddNewUserInfo(id, tokens) {
    logins[id] = tokens;
    SaveAllClientLoginsToFile();
}

export async function LoadAllClientLoginsFromFile() {
    // if the file doesn't exist creates it 
    if (!fs.existsSync(LOGINS_PATH)) {
        const LOGINS_DIR = path.dirname(LOGINS_PATH); // Get the directory part
        // Ensure the directory exists
        if (!fs.existsSync(LOGINS_DIR)) {
            fs.mkdirSync(LOGINS_DIR, { recursive: true }); // Creates all missing directories
        }
        // creates a blank file 
        fs.writeFile(LOGINS_PATH, JSON.stringify({}), (err) => {
            if (err)
                console.error("error creating logins file ", LOGINS_PATH, err);
        });
    }
    // reads a list of "tokens" from the logins file; 
    try {
        const data = fs.readFileSync(LOGINS_PATH, 'utf8');
        const tokens = JSON.parse(data);
        //console.log("read json from file ", tokens);

        if (!tokens) {
            console.error(`error reading login file at: ${LOGINS_PATH} make sure it exists and is in json format`);
            return;
        }
        AddVerifiedTokensToLogins(tokens);
    }
    catch (e) {
        console.error(e);
    }
}

async function AddVerifiedTokensToLogins(tokens) {
    // waits for each token to resolve and obtain a valid refresh token before resolving/settling.

    const oauthClient = GetOAuthClient();
    const results = await Promise.allSettled(Object.entries(tokens).map(async ([key, token]) => addNewRefreshTokens(key, token, await refreshAccessToken(oauthClient, token))));

    function addNewRefreshTokens(key, original, refreshToken) {
        if (!logins[key] && refreshToken !== undefined)  // if the token doesnt already exist in the login  
        {
            // !!!! logins currently just have the tokens, will be changing in the near future
            original["access_token"] = refreshToken;
            logins[key] = original;
        }
    }

    // if one was unsuccessful we save to file everything else that made it, so we dont have to try it again. 
    for (var result in results) {
        if (!result) {
            console.log("one or more refresh access tokens are invalid, will be removed from saved file");
            SaveAllClientLoginsToFile();
            break;
        }
    }
    // async allows us to queue all refresh tokens and verify them before adding them to the list. 
}

function SaveAllClientLoginsToFile() {
    fs.writeFile(LOGINS_PATH, JSON.stringify(logins), (err) => {
        if (err)
            console.error(err);
        else
            console.log("saved logins to file");
    });
}