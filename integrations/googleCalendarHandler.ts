// Discovery doc URL for APIs used by the quickstart
//const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
// allows the extention of the tcpserver basehandler so we can create a new handler
import { BaseHandler, GetContentHeaders, TcpClient } from "./tcpServer";
import { logins, GetOAuthClient } from './oauthHandler';
import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
// since this can potentially have more than one user/calendar wanting to stay signed in at once, we create a user client. 
// so long as a calendarClient exists within the CalendarHandler, it can be saved to file and recalled on the next users input. 


export class CalendarHandler extends BaseHandler {
  // HANDLES ALL INCOMING POST REQUESTS TO THE CALENDAR HANDLER 
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
  oauth2Client.setCredentials(tokens);
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
    supportsAttachments: true, 
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
      description: data['description'],
    },
  } as calendar_v3.Params$Resource$Events$Insert);
}
