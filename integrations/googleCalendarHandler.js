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
//const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
// allows the extention of the tcpserver basehandler so we can create a new handler
const { BaseHandler, GetContentHeaders } = require("./tcpServer.js");
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
  }


  // HANDLES ALL INCOMING GET REQUESTS TO THE CALENDAR HANDLER 
  HandleGet(client) {
    const pathname = client.url.pathname.replace('/calendar/', '');
    switch (pathname) {
      case 'startoauth':
        this.HandleStartOauth(client);
        break;
      case 'oauthcallback':
        this.HandleOauthCallback(client);
        break;
      case 'requestdata':
        this.HandleRequestData(client);
        break;
      default:
        console.error(`couldn't find pathname ${pathname}`);
        client.SendResponse(500, "couldnt find correct action");
        break;
    }
  }

  // #region directs the user to a generated google login url where they can login with their user info. 
  HandleStartOauth(client) {
    var oauthurl = this.generateLoginURL();
    client.SendResponse(200, { oauthurl })
  }
  generateLoginURL() {
    // Authorization scopes required by the API; multiple scopes can be included, separated by spaces.
    // checkout scopes here:  https://developers.google.com/calendar/api/auth
    const scope = ['https://www.googleapis.com/auth/calendar'];

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: "offline", // Required for refresh tokens
      //prompt: "consent", // forces asking for user consent (usually only happens the first time)
      scope: scope,
    });
    console.log("Authorize this app by visiting this URL:", authUrl);
    return authUrl;
  }
  //#endregion


  // #region when the google authentication is complete it will send a get request to the REDIRECT_URL (assuming its whitelisted)
  HandleOauthCallback(client) {
    // sends back a webpage/(the onSucess text as a webpage) which then sends some data back to the original webpage(window.opener)
    console.log("using context oauthcallback, found queries:", JSON.stringify(client.queries));
    // uses the code to setup the oauth credentials (async)
    this.attemptLogin(client.queries["code"]).then(e => {
      client.SendResponse(200, this.onSuccess, GetContentHeaders(".html"));
    }).catch(e => {
      client.SendResponse(500, "ERROR OCCURED HANDLING OAUTH CALLBACK");
    });
  }
  async attemptLogin(code) {
    if (!code)
      return;
    // tries to get some sort of session token that it can use. (a handshake of some sort?) 
    const { tokens } = await this.oauth2Client.getToken(code); // needs {} around the token apparently
    this.oauth2Client.setCredentials(tokens);



    this.oauth2Client.on('tokens', (tokens) => {
      if (tokens.refresh_token) {
        console.log("New Refresh Token:", tokens.refresh_token);
      }
      console.log("New Access Token:", tokens.access_token);
    });

  }

  onSuccess = `<!DOCTYPE html>
    <html>
      <body>
        <h1> success </h1>
        <script>
          window.onbeforeunload = () => {
            window.opener.postMessage('{"type": "oauth successful", "id": "test"}' , "*");
          };
          window.close(); 
        </script>
      </body>
    </html>`


  saveLogin() {
    // ... write tokens / code to a file or something to use later?
  }

  //#endregion


  // #region once verification is complete the user can attempt to request data
  HandleRequestData(client) {
    if (client.queries['id'] == "test") {
      // once it recieves the data then it sends a response back
      var fetchEvents = this.fetchListUpcomingEvents();
      fetchEvents.then(response => {
        console.log("requested data found", response.data);
        client.SendResponse(200, response.data);
      }).catch(e => {
        console.error(e);
        client.SendResponse(500, "error trying to retrive requested data");
      });
    }
  }

  async refreshAccessToken() {
    const newTokens = await this.oauth2Client.refreshAccessToken();
    this.oauth2Client.setCredentials(newTokens.credentials);
  }

  fetchListUpcomingEvents() {



     // creates a google calendar instance with authentication. 
     // (creating here to make sure oauth2Client is the current version)
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    console.log("OAuth2 Credentials:", this.oauth2Client.credentials);
    

    // returns a promise
    return this.calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: "startTime",
      //key: API_KEY, //?? not sure if i need this 
    });
  }
  //#endregion






  signOut(userID) {
    // deletes any associated files, and removes the user from any active objects.  
  }
}


module.exports = { AssertEnv, CalendarHandler }