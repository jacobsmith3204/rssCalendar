
const rssFeedObj = {
    title: "facebook", 
    description: "attempted to create a custom rss feed titled 'facebook'", 

    feed_url: `${location.origin}/rss/facebook.xml`, 
    site_url: `${location}`
}

/*
feedOptions = {
    title:              string Title of your site or feed
    description:        optional string A short description of the feed.
    generator:          optional string Feed generator.
    feed_url:           url string Url to the rss feed.
    site_url:           url string Url to the site that the feed is for.
    image_url:          optional url string Small image for feed readers to use.
    docs:               optional url string Url to documentation on this feed.
    managingEditor:     optional string Who manages content in this feed.
    webMaster:          optional string Who manages feed availability and technical support.
    copyright:          optional string Copyright information for this feed.
    language:           optional string The language of the content of this feed.
    categories:         optional array of strings One or more categories this feed belongs to.
    pubDate:            optional Date object or date string The publication date for content in the feed
    ttl:                optional integer Number of minutes feed can be cached before refreshing from source.
    hub:                optional PubSubHubbub hub url Where is the PubSubHub hub located.
    custom_namespaces:  optional object Put additional namespaces in element (without 'xmlns:' prefix)
    custom_elements:    optional array Put additional elements in the feed (node-xml syntax)
}
*/



function PressedButton(){
    const xhr = new XMLHttpRequest(); 

    xhr.open("POST", `${location.origin}`, true);
    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 201) {
            console.log(JSON.parse(xhr.responseText));
        }
    };

    const data = JSON.stringify({ type: "createRSS", data : rssFeedObj});
    xhr.send(data);
}