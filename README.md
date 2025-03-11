# rssCalendar
a rss server that allows users to create upcomming events, which are then posted to social media, with the ability for people to subscribe the rss feed to their google calendar or other app of their choosing




## since the server has external apis that it uses. 
to use everything fully you'll need to add a ".env" file and inside add the following 

```
GOOGLE_CALENDAR_CLIENT_ID=[CLIENT_ID] 
GOOGLE_CALENDAR_API_KEY=[API_KEY]
```

## to run the server while in the main directory simply
`node --env-file=.env server.js`



### Relevant API documentation 

google calendar (nodejs)
  https://googleapis.dev/nodejs/googleapis/latest/calendar/index.html
