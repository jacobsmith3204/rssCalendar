import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import path from 'path';
import fs from 'fs';

const API_KEY = process.env.GOOGLE_CALENDAR_API_KEY;
const CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;

const REDIRECT_URL = "https://localhost:8000/calendar/oauthcallback";
const LOGINS_PATH = path.join(__dirname.replace('integrations', ''), "/hidden/logins.json");


export var logins = {};



export async function Initialise() {
    await LoadAllClientLoginsFromFile();
    console.log(logins);
}



export function GetOAuthClient() {
    return new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
}

export async function getUserInfo(oauthClient) {
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
        console.log("read json from file ", tokens);

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
    const results = await Promise.allSettled(Object.entries(tokens).map(async ([key, token]) => addNewRefreshTokens(key,token, await refreshAccessToken(oauthClient, token))));

    function addNewRefreshTokens(key,original, refreshToken) {
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

export async function refreshAccessToken(oauthClient : OAuth2Client, token) {
    oauthClient.setCredentials(token);
    try {
        const { token } = await oauthClient.getAccessToken();
        console.log("new token:", token);
        oauthClient.setCredentials({ access_token: token });
        return token;
    }
    catch (e) {
        console.error("ERROR:", e);
        return undefined;
    }
}


function SaveAllClientLoginsToFile() {
    fs.writeFile(LOGINS_PATH, JSON.stringify(logins), (err) => {
        if (err)
            console.error(err);
        else
            console.log("saved logins to file");
    });
}