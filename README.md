# rssCalendar
a rss server that allows users to create upcomming events, which are then posted to social media, with the ability for people to subscribe the rss feed to their google calendar or other app of their choosing




# Setup process  
to use everything, you'll need to setup a ".env" file, which will store protected environment information.  
A completed .env file would look as follows and should be in the main directory with the server.js file. the setup process is bellow. 
```
SERVER_CERT_DIR=[PATH_TO_SERVER.CERT (generated via openssl)]
SERVER_KEY_DIR=[PATHT_TO_SERVER.KEY (generated via openssl )]

GOOGLE_CALENDAR_CLIENT_ID=[CLIENT_ID]
GOOGLE_CALENDAR_CLIENT_SECRET=[CLIENT_SECRET]
GOOGLE_CALENDAR_API_KEY=[API_KEY]

IG_USERNAME=[INSTAGRAM_USERNAME]
IG_PASSWORD=[INSTAGRAM_PASSWORD]
```


## server .cert & .key via openssl for https 
since the server needs to be implement https you need to generate ".cert" and ".key" files
cd into the directory you want the files to be placed and run the following command. it will run through a terminal setup wizard  
`openssl req -nodes -new -x509 -keyout server.key -out server.cert`  
if you don't have openssl it's included as part of git, locate the git install directory then
`\Git\usr\bin\openssl.exe` to get to the openssl filepath.  
then rerun the above command with the absolute filepath to the openssl executable. `PATH\Git\user\bin\openssl.exe req -nodes -ne...`
add the file path to the .cert and .key to the .env (will accept local paths eg: hidden/server.key);

```
SERVER_CERT_DIR=[PATH_TO_SERVER.CERT (generated via openssl)]
SERVER_KEY_DIR=[PATHT_TO_SERVER.KEY (generated via openssl )]
```


## google api 
setup a new google cloud project, and setup aouth, follow this tutorial if you need some help 
https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred  

console.cloud.google -> api -> credentals -> oauth2 clientID's authorised redirect URIs = https://localhost:8000/oauth/oauthcallback

then copy-paste the relevant data into the .env file  
```
GOOGLE_CALENDAR_CLIENT_ID=[CLIENT_ID]
GOOGLE_CALENDAR_CLIENT_SECRET=[CLIENT_SECRET]
GOOGLE_CALENDAR_API_KEY=[API_KEY]
```

## instagram api
add a correct username and password to the .env file to allow the server to post to Instagram.   
```
IG_USERNAME=[INSTAGRAM_USERNAME]
IG_PASSWORD=[INSTAGRAM_PASSWORD]
```

&nbsp;
&nbsp;
&nbsp;
&nbsp;

# to run the server  
Install dependencies

`npm install` or `npm ci`

while in the main directory simply
`npm start`

See `package.json`

  
&nbsp;
&nbsp;
  
# Other Relevant API documentation 
### google calendar (nodejs)
  (the nodejs api documentation is actually kinda terrible, it focuses on a blogger integration)  
  https://googleapis.dev/nodejs/googleapis/latest/calendar/index.html

### instagram : instagram-private-api 
  api for posting to Instagram, the tutorial is relatively straightforward.  
  https://www.ryancarmody.dev/blog/how-to-automate-instagram-posts-with-nodejs

### facebook : facebook-chat-api
options  
1. no official support for group chat messages, so this git repo is probably the simplest way to do it.   
  https://github.com/Schmavery/facebook-chat-api  
2. The other option I've been considering is posting to the Facebook page and then sharing it from there to the group chat. 
  https://developers.facebook.com/docs/pages-api/posts/  
  https://developers.facebook.com/docs/messenger-platform/send-messages/
  
