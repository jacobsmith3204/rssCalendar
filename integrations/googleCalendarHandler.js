const CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
const API_KEY = process.env.GOOGLE_CALENDAR_API_KEY;

const REDIRECT_URL = "https://localhost:8000/calendar/oauthcallback";

//makes sure the above constants are assigned properly 
function AssertEnv() {
  console.log("running assert");
  console.assert((CLIENT_ID && API_KEY), `.env not setup properly CLIENT_ID:${CLIENT_ID}, API_KEY${API_KEY}`);
}

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
// allows the extention of the tcpserver basehandler so we can create a new handler
const { BaseHandler } = require("./tcpServer.js");
const url = require('url');
// loads in the stuff from google

const { google } = require('googleapis');



class CalendarHandler extends BaseHandler {
  constructor() {
    super();

    // initalises a oauth2 obj
    this.oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URL, 
    );
    // creates a google calendar instance with authentication. 
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    // logs a login link for google to verify the user account. 
    this.generateLoginURL();
  }



  HandleGet(client) {
    
    //var path = client.url.pathname.replace("/calendar/", "");

    const pathname = client.url.pathname.replace('/calendar/', '');
    switch (pathname) {
      case 'oauthcallback':
        // 
        console.log("using context oauthcallback, found queries:", JSON.stringify(client.queries));
        this.attemptLogin(client.queries["code"]); // do something here with the callback code 
        client.SendResponse(200, "success");
        break;
      default:
        console.error(`couldn't find pathname ${pathname}`);
        client.SendResponse(500, "couldnt find correct action");
        break;
    }
  }


  generateLoginURL(){
    // Authorization scopes required by the API; multiple scopes can be included, separated by spaces.
    // checkout scopes here:  https://developers.google.com/calendar/api/auth
    const scope = ['https://www.googleapis.com/auth/calendar'];
    
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: "offline", // Required for refresh tokens
      scope: scope,
    });
    console.log("Authorize this app by visiting this URL:", authUrl);
  }

  async attemptLogin(code) {
    if(!code)
      return;
    // tries to get some sort of session token that it can use. (a handshake of some sort?) 
    const tokens = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens); 
  }

  saveLogin() {

  }

  signOut() {

  }

  async listUpcomingEvents() {

    const res = await this.calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: "startTime",
      //key: API_KEY, //?? not sure if i need this 
    });
    console.log("calendar events results", res);

  }
}


module.exports = { AssertEnv, CalendarHandler }