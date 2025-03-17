const CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
const API_KEY = process.env.GOOGLE_CALENDAR_API_KEY;

const REDIRECT_URL = "https://localhost:8000/calendar/oauthcallback";
const LOGINS_PATH = path.join(__dirname.replace('integrations', ''), "/hidden/logins.json");
//makes sure the above constants are assigned properly 
export function AssertEnv() {
  console.log("running assert");
  console.assert((CLIENT_ID && API_KEY), `.env not setup properly CLIENT_ID:${CLIENT_ID}, API_KEY${API_KEY}`);
}

// Discovery doc URL for APIs used by the quickstart
//const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
// allows the extention of the tcpserver basehandler so we can create a new handler
import { BaseHandler, GetContentHeaders, TcpClient } from "./tcpServer";
import url from 'url';
import { google } from 'googleapis';
import { Console, dir, log } from "console";
import fs from 'fs';
import path, { resolve } from 'path';
import { promises } from "dns";




class CalendarClient {
  // since this can potentially have more than one user/calendar wanting to stay signed in at once, we create a user client. 
  // so long as a calendarClient exists within the CalendarHandler, it can be saved to file and recalled on the next users input. 
  oauth2Client;
  calendar;
  // [ once a user has signed in we store its id as in localstorage, where we can fetch it again on a page refresh to skip the signin process ]
  id;
  tokens;

  constructor(tokens) {
    this.tokens = tokens;
    this.oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URL,
    );
    this.oauth2Client.setCredentials(tokens);
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  async refreshAccessToken() {
    try {
      const { token } = await this.oauth2Client.getAccessToken();
      console.log("new token:", token);
      this.oauth2Client.setCredentials({ access_token: token });
      return true;
    }
    catch (e) {
      console.error("ERROR:", e);
      return false;
    }

  }

  toJSON() {
    return this.tokens; // This ensures JSON.stringify uses class.data
  }

  // 
  fetchListUpcomingEvents(data: object) {
    //this.refreshAccessToken(); 
    // gets the events (returns as a promise)
    return this.calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: "startTime",
    });
  }
  addNewEventToCalendar(data: object) {
    //this.refreshAccessToken(); 
    // creates the new event (returns as a promise)
    return this.calendar.events.insert({
      calendarId: data['id'],
      resource: {
        start: {
          dateTime: new Date(data["start"]).toISOString(), // Correct structure
          timeZone: "UTC", // Specify time zone (adjust if needed)
        },
        end: {
          dateTime: new Date(data["end"]).toISOString(),
          timeZone: "UTC",
        },
        summary: data['summary'], // Required field, give it a title
        location: data['address'],
      },
    });
  }
}





export class CalendarHandler extends BaseHandler {
  oauth2Client;
  logins = {}

  constructor() {
    super();

    // initalises a oauth2 obj
    this.oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URL,
    );

    // loads logins from file
    this.LoadFromFile();
  }


  // HANDLES ALL INCOMING GET REQUESTS TO THE CALENDAR HANDLER 
  HandleGet(client: TcpClient) {

    const pathname = client.url.pathname.replace('/calendar/', '');
    switch (pathname) {
      case 'startoauth':
        client.SendResponse(200, { oauthurl: this.generateLoginURL() });
        break;
      case 'oauthcallback':
        this.HandleOauthCallback(client);
        break;
      case 'validatelastloginid':
        client.SendResponse(200, { response: (this.logins[client.queries["id"]]) ? 'successful' : 'unsuccessful' });
        break;
      default:
        console.error(`calendarHandler GET: couldn't find pathname ${pathname}`);
        client.SendResponse(500, "couldnt find correct action");
        break;
    }
  }
  HandlePost(client: TcpClient) {
    const pathname = client.url.pathname.replace('/calendar/', '');
    switch (pathname) {
      case 'requestdata':
        this.HandleRequestData(client);
        break;
      default:
        console.error(`calendarHandler POST: couldn't find pathname ${pathname}`);
        client.SendResponse(500, "couldnt find correct action");
        break;
    }
  }


  generateLoginURL() {
    // Authorization scopes required by the API; multiple scopes can be included, separated by spaces.
    // checkout scopes here:  https://developers.google.com/calendar/api/auth
    const scope = [
      'https://www.googleapis.com/auth/calendar',
      "openid",
    ];
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: "offline", // Required for refresh tokens 
      scope: scope,
      prompt: "consent", // forces asking for user consent (usually only happens the first time)
    });
    console.log("Authorize this app by visiting this URL:", authUrl);
    return authUrl;
  }



  // #region when the google authentication is complete it will send a get request to the REDIRECT_URL (assuming its whitelisted)
  HandleOauthCallback(client) {
    // sends back a webpage/(the onSucess text as a webpage) which then sends some data back to the original webpage(window.opener)
    console.log("using context oauthcallback, found queries:", JSON.stringify(client.queries));
    // uses the code to setup the oauth credentials (async)
    this.attemptLogin(client.queries["code"])
      .then(id => client.SendResponse(200, this.onSuccess(id), GetContentHeaders(".html")))
      .catch(e => {
        client.SendResponse(500, "ERROR OCCURED HANDLING OAUTH CALLBACK");
        console.error(e);
      });
  }
  onSuccess(id) {
    return `<!DOCTYPE html>
    <html>
      <body>
        <h1> success </h1>
        <script>
          window.onbeforeunload = () => {
            window.opener.postMessage('{"type": "oauth successful", "id": "${id}", "action":"view"}' , "*");
          };
          window.close(); 
        </script>
      </body>
    </html>`
  }

  async attemptLogin(code): Promise<string> {
    if (!code) return;
    // tries to get some sort of session token that it can use. (a handshake of some sort?) 

    const result = new Promise<string>((resolve) => {
      this.oauth2Client.on('tokens', async (tokens) => {
        console.log("auth2Client.on('tokens') called, calendarhandler.oauth2Client set credentials with tokens:", tokens);
        // applies the credentials
        this.oauth2Client.setCredentials(tokens);

        // if we find a refresh token (only provided when logging on the first time, or explicitly requested) 
        // grabs the user data to find an id then add it to the logins object
        if (tokens.refresh_token) {
          console.log("New Refresh Token:", tokens.refresh_token, "\n adding token ");

          // gets the users data 
          const userData = await this.getUserInfo();

          // creates a new calendar client for this users id. 
          console.log(`\n\n user data was:`, userData);
          this.logins[userData.id] = new CalendarClient(tokens);
          this.SaveToFile();
          resolve(userData.id);
        }
        else {
          console.log("New Access Token:", tokens.access_token);
          resolve("");
        }
      })
    });


    const { tokens } = await this.oauth2Client.getToken(code);
    return await result;
  }

  async getUserInfo() {

    // Ensure the client has a valid access
    console.log("\n\n GET USER INFO, CHECKING CREDENTIALS: ", this.oauth2Client.credentials);

    const oauth2 = google.oauth2({
      auth: this.oauth2Client,
      version: 'v2',
    });

    const res = await oauth2.userinfo.get();
    console.log("User Info:", res.data);
    return res.data; // Returns email, ID, name, etc.
  }
  //#endregion


  // #region once verification is complete the user can attempt to request data
  HandleRequestData(client) {
    const userid = client.queries['id'];
    const user = this.logins[userid] as CalendarClient;


    if (!user) {
      console.warn("no user found for", userid);
      return;
    }

    // once it recieves the data then it sends a response back
    var fetchEvents;
    switch (client.queries["action"]) {
      case "view":
        fetchEvents = user.fetchListUpcomingEvents(client.data); // gets all events 
        break;
      case "addevent":
        fetchEvents = user.addNewEventToCalendar(client.data); // adds new event
        break;
      default:
        fetchEvents = new Promise(resolve => { resolve({ data: `couldn't find action: ${client.queries["action"]}` }) });
        break;
    }

    fetchEvents.then(response => {
      console.log("fetch events got response:", response.data);
      client.SendResponse(200, response.data);
    }).catch(e => {
      console.error(e);
      client.SendResponse(500, "error trying to retrive requested data");
    });
  }



  //#region user management 
  LoadFromFile() {
    fs.readFile(LOGINS_PATH, 'utf8', (err, data) => {
      const tokens = JSON.parse(data);
      console.log("read json from file ", tokens);
      if (err || !tokens) {
        console.error(`error reading login file at: ${LOGINS_PATH} make sure it exists and is in json format`);
        return;
      }
      this.AddVerifiedTokensToLogins(tokens);
    });
  }

  async AddVerifiedTokensToLogins(tokens) {
    // waits for each token to resolve and obtain a valid refresh token before resolving/settling.
    const calendarHandler = this;
    const results = await Promise.allSettled(Object.entries(tokens).map(([key, token]) => addLoginOnAfterSucessfulVerification(key, token)));

    // if one was unsuccessful we save to file everything else that made it, so we dont have to try it again. 
    for (var result in results) {
      if (!result) {
        console.log("one or more refresh access tokens are invalid, will be removed from saved file");
        this.SaveToFile();
        break;
      }
    }

    // async allows us to queue all refresh tokens and verify them before adding them to the list. 
    async function addLoginOnAfterSucessfulVerification(key, token) {
      return new Promise<boolean>(async resolve => {
        // if it already exist within the logins object
        if (calendarHandler.logins[key]) {
          resolve(true);
          return;
        }

        // else creates a new calendar event based on the tokens
        const login = new CalendarClient(token);
        const success = await login.refreshAccessToken();
        if (success)
          calendarHandler.logins[key] = login;
        resolve(success);

      });
    }
  }


  SaveToFile() {
    fs.writeFile(LOGINS_PATH, JSON.stringify(this.logins), (err) => {
      if (err)
        console.error(err);
      else
        console.log("saved logins to file");
    });
  }
  //#endregion





  //#region not so redundant code (may need again at a later date)
  //#endregion
}