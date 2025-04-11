// Discovery doc URL for APIs used by the quickstart
//const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
// allows the extention of the tcpserver basehandler so we can create a new handler
import { BaseHandler, GetContentHeaders, TcpClient } from "./tcpServer";
import { getUserInfo, refreshAccessToken, logins, AddNewUserInfo, GetOAuthClient } from '../admin';
import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
// since this can potentially have more than one user/calendar wanting to stay signed in at once, we create a user client. 
// so long as a calendarClient exists within the CalendarHandler, it can be saved to file and recalled on the next users input. 

const FORCE_CONSENT_PROMPT = true;


export class CalendarHandler extends BaseHandler {
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
        client.SendResponse(200, { response: (logins[client.queries["id"]]) ? 'successful' : 'unsuccessful' });
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
      // tries to get some sort of session token that it can use. (a handshake of some sort?) 
      const oauth2Client = GetOAuthClient();
      var { tokens } = await oauth2Client.getToken(code);
      console.log("oauth got tokens", tokens);
      // uses the returned tokens to set the credentials 
      oauth2Client.setCredentials(tokens);

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


  // process a clients post request, makes sure the request query has a userid, then fetches the appropriate 
  async HandleRequestData(client) {
    const userid = client.queries['id'];
    // uses the associated client data to get a completed oauthclient. 
    const oauth2Client = await fetchAuthorisedClient(userid);
    if (!oauth2Client) {
      console.warn("user not found or doesn't have access", userid);
      return;
    }
    
    //console.log("credentials:",oauth2Client.credentials);

    // once it recieves the data then it sends a response back
    try {
      var response;
      switch (client.queries["action"]) {
        case "view":
          response = await fetchListUpcomingEvents(client.data, oauth2Client); // gets all events 
          break;
        case "addevent":
          response = await addNewEventToCalendar(client.data, oauth2Client); // adds new event
          break;
        default:
          response = await { data: `couldn't find action: ${client.queries["action"]}` };
          break;
      }

      if (!response || !response.data) {
        throw "response was invalid";
      }
      console.log("fetch events got response:", response.data);
      client.SendResponse(200, response.data);
    }
    catch (e) {
      console.error("\n error trying to retrive requested data", e);
      client.SendResponse(500, "error trying to retrive requested data");
    }
  }
}




// !!! 
async function fetchAuthorisedClient(userid): Promise<OAuth2Client> {
  if (!logins[userid])
    return null;
  const tokens = logins[userid];  // gets the tokens 

  

  // creates a new oauth client and sets its credentials to the token from the user that created it. 
  const oauth2Client = GetOAuthClient();
  console.log("\n\n setting tokens", tokens);
  console.log( "\n\n", logins , "\n\n\n");

  oauth2Client.setCredentials(tokens);
  //refreshAccessToken(oauth2Client, tokens); 
  return await oauth2Client;
}




async function fetchListUpcomingEvents(data: object, auth: OAuth2Client): Promise<object> {
  // gets the events (returns as a promise)
  const calendar = google.calendar({ version: 'v3', auth: auth });
  return calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: "startTime",
  });
}
async function addNewEventToCalendar(data: object, auth: OAuth2Client): Promise<object> {
  // creates the new event (returns as a promise)
  const calendar = google.calendar({ version: 'v3', auth: auth });
  return calendar.events.insert({
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
  } as calendar_v3.Params$Resource$Events$Insert);
}
