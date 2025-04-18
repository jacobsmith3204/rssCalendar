
//#region RSS

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
const rssFeedObj = {
    title: "facebook",
    description: "attempted to create a custom rss feed titled 'facebook'",

    feed_url: `${location.origin}/rss/facebook.xml`,
    site_url: `${location}`
}
function PressedButton() {
    PostJSON(
        `${location.origin}/rss`,
        { type: "createRSS", data: rssFeedObj }
    ).then(response => {
        console.log(response);
    });
}
//#endregion



//#region  google calendar stuff
function HandleAuthClick() {
    FetchJSON(`${location.origin}/oauth/startoauth`).then(
        function StartOauthRedirect(data) {
            var url = data["oauthurl"];
            console.log(data, url);
            // 
            if (!url)
                return;

            // sets up a listener to catch when the created window is closed. 
            window.addEventListener("message", CompleteOauthRedirect);
            // creates the window 
            window.open(url, "_blank");
            console.log("opening window");
        }
    );
}
function CompleteOauthRedirect(event) {

    console.log(event, "event data", event.data);
    var obj = JSON.parse(event.data);  // expects the message to be a json object 
    console.log(event.data, obj);
    if (!obj)
        return;

    if (obj.type == "oauth successful") {
        // assigns an id to this object from the callback redirect when it closes to finish the verification. 
        localStorage.setItem("calendarid", obj.id);

        console.log("closed window Sucessful Oauth");
        CalendarSwitchToAuthorised();
    }
    else
        console.log("closed window");
}


function AddCalendarEventFromForm(event) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.target));
    console.log(form);

    PostJSON(`${location.origin}/calendar/requestdata?id=${localStorage.getItem("calendarid")}&action=addevent`, form).then(
        function onData(data) {
            console.log("add calendar event callback:", data);
            document.getElementById('calendarResults').innerText = "added event";
        }
    );
}


function GetCalendarInfo(event) {
    /*
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.target)); 
    console.log(form);
    */

    const form = {};

    PostJSON(`${location.origin}/calendar/requestdata?id=${localStorage.getItem("calendarid")}&action=view`, form).then(
        function onData(data) {
            console.log("request for calendar data found:", data);

            // gets only the summary from the data
            var simplified = { summary: data.summary, items: [] }
            data.items.forEach(item => { simplified.items.push(item.summary); });

            // writes it to the results div. 
            document.getElementById('calendarResults').innerText = JSON.stringify(simplified);
        }
    );
    return false;
}

function HandleSignoutClick() {
    // does nothing
}

function ValidateLastLoginId() {

    FetchJSON(`${location.origin}/oauth/validatelastloginid?id=${localStorage.getItem("calendarid")}`)
        .then(data => {
            if (data["response"] == "successful")
                CalendarSwitchToAuthorised();
        })
}

function CalendarSwitchToAuthorised() {
    document.getElementById('calendar_oauth_authorized').style.visibility = 'visible';
    document.getElementById('authorize_button').style.visibility = 'hidden';
}
//#endregion


//#region download iframe as png 


function DownloadIframeAsPng() {
    const iframe = document.getElementById("myIframe"); // Select the iframe

    if (iframe.contentDocument.readyState === 'complete')
        StartDownload();
    else
        iframe.onload = StartDownload;


    // Wait for the iframe to load
    function StartDownload() {
        try {
            console.log("loaded iframe");

            // Access iframe content to render 
            const iframeDoc = iframe.contentDocument;
            const iframeBody = iframeDoc.body;

            // can set image settings like width and height
            renderToImage(iframeBody, { width: 1920, height: 1080 }).then(ProvideDownloadLink);


        } catch (error) {
            console.error("error with iframe download", error);
            // "might not be able to access iframe content due to CORS restrictions." 
        }
    };
    async function renderToImage(iframeBody, imageSettings = { width: 1920, height: 1080 }) {
        // creates a canvas to render on 
        const canvas = document.createElement("canvas");
        canvas.width = imageSettings.width;  // Set your resolution
        canvas.height = imageSettings.height;

        // Use an inline SVG to render HTML
        // uses this xmlns="http://www.w3.org/2000/svg" to load the canvas as an image
        const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}"> 
            <foreignObject width="100%" height="100%">
                ${new XMLSerializer().serializeToString(iframeBody)}
            </foreignObject>
        </svg>`;

        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
        // waits for image to load
        await new Promise(resolve => {
            img.onload = () => {

                ctx.drawImage(img, 0, 0);
                resolve();
            }
        });
        return await canvas;
    }
    function ProvideDownloadLink(canvas) {
        //document.body.appendChild(canvas); // Append screenshot canvas to page to see it before its downloaded
        const img = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = img;
        link.download = "screenshot.png";
        link.click();
    }
}


//#endregion

//#region ocr 



async function OCRImage() {

    const fileInput = document.getElementById('fileInput');
    var file = fileInput.files[0];

    console.log(file);

    const reader = new FileReader();
    reader.onloadend = function () {
        const base64String = reader.result.split(',')[1];
        PostJSON(`${location.origin}/ocr/${file.name}`, { image: base64String }, {
            'Content-Type': 'application/octet-stream', // Binary data
            'X-File-Name': file.name // Send filename in headers
        }).then(data => {
            const preview = document.getElementById('ocrResults');
            preview.innerHTML = data["response"];
        });
    }
    reader.readAsDataURL(file);
}
function OCRFileChanged() {
    const preview = document.getElementById('preview');
    const fileInput = document.getElementById('fileInput');
    var file = fileInput.files[0];

    const reader = new FileReader();

    reader.onload = function (e) {
        preview.src = e.target.result;
        preview.style.display = "block";
    }
    reader.readAsDataURL(file);
}

//#endregion







//#region helper functions 

async function PostJSON(url, data, headers = { "Content-Type": "application/json;charset=UTF-8" }) {
    if (typeof data === 'object') // &&  !(data instanceof Buffer || data instanceof Uint8Array))
        data = JSON.stringify(data);
    return FetchJSON(url, { method: 'POST', headers, body: data })
}
async function FetchJSON(url, options = {}) {
    try {
        const res = await fetch(url, options);
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
        return await res.json();
    }
    catch (error) {
        console.error("POST Error:", error);
        return null;
    }
}

//#endregion