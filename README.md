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

then copy-paste the relevant data into the .env file  
```
GOOGLE_CALENDAR_CLIENT_ID=[CLIENT_ID]
GOOGLE_CALENDAR_CLIENT_SECRET=[CLIENT_SECRET]
GOOGLE_CALENDAR_API_KEY=[API_KEY]
```

&nbsp;
&nbsp;
&nbsp;
&nbsp;

# to run the server  
while in the main directory simply
`node --env-file=.env server.js`

  
  
&nbsp;
&nbsp;
  
# Other Relevant API documentation 
### google calendar (nodejs)
  https://googleapis.dev/nodejs/googleapis/latest/calendar/index.html
