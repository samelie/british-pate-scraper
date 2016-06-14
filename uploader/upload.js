/**
 * This script uploads a video (specifically `video.mp4` from the current
 * directory) to YouTube,
 *
 * To run this script you have to create OAuth2 credentials and download them
 * as JSON and replace the `credentials.json` file. Then install the
 * dependencies:
 *
 * npm i r-json lien opn bug-killer
 *
 * Don't forget to run an `npm i` to install the `youtube-api` dependencies.
 * */

const Youtube = require("youtube-api"),
    fs = require("fs"),
    readJson = require("r-json"),
    Lien = require("lien"),
    Logger = require("bug-killer"),
    opn = require("opn"),
    Q = require("bluebird"),
    prettyBytes = require("pretty-bytes");

var argv = require('yargs').argv;
// I downloaded the file from OAuth2 -> Download JSON
const CREDENTIALS = readJson(`${__dirname}/credentials.json`);
let _upload = argv.manifest || 'downloaded_manifest.json'
const UPLOADS = readJson(`${__dirname}/${_upload}`);

// Init lien server
let server = new Lien({
    host: "localhost",
    port: 5000
});

// Authenticate
// You can access the Youtube resources via OAuth2 only.
// https://developers.google.com/youtube/v3/guides/moving_to_oauth#service_accounts
let oauth = Youtube.authenticate({
    type: "oauth",
    client_id: CREDENTIALS.web.client_id,
    client_secret: CREDENTIALS.web.client_secret,
    redirect_url: CREDENTIALS.web.redirect_uris[0]
});

opn(oauth.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtubepartner",
        "https://www.googleapis.com/auth/youtube.force-ssl"
    ]
}));

// Handle oauth2 callback
server.addPage("/oauth2callback", lien => {
    Logger.log("Trying to get the token using the following code: " + lien.query.code);
    oauth.getToken(lien.query.code, (err, tokens) => {

        if (err) {
            lien.lien(err, 400);
            return Logger.log(err);
        }

        Logger.log("Got the tokens.");

        oauth.setCredentials(tokens);

        lien.end("The video is being uploaded. Check out the logs in the terminal.");

        Q.map(UPLOADS, (vo) => {
            return new Q((resolve, reject) => {
                if(!fs.existsSync(vo)){
                    return resolve()
                }
                var req = Youtube.videos.insert({
                    resource: {
                        // Video title and description
                        snippet: {
                            title: String(Math.random() * 999999),
                            defaultLanguage: 'en',
                            localizations: {
                                "English": "en"
                            }
                        }
                        // I don't want to spam my subscribers
                        ,
                        status: {
                            privacyStatus: "public"
                        }
                    }
                    // This is for the callback function
                    ,
                    part: "snippet,status"

                    // Create the readable stream to upload the video
                    ,
                    media: {
                        body: fs.createReadStream(vo)
                    }
                }, (err, data) => {
                    clearInterval(_i)
                    let _id = data.id
                    console.log(_id);
                    Youtube.captions.insert({
                        part: 'snippet',
                        /* snippet: {
                             "videoId": _id,
                             "trackKind": 'ASR',
                             "language": 'en-GB',
                             "isDraft": false,
                             "name": 'sam-auto-track',
                         },*/
                        /*resource: {
                            snippet: {
                                "videoId": _id,
                                "trackKind": 'ASR',
                                "language": 'en-GB',
                                "isDraft": false,
                                "name": 'sam-auto-track',
                            }
                        },*/
                        resource: {
                            "videoId": _id,
                            "trackKind": 'ASR',
                            "language": 'en',
                            "name": ' ',
                            "isDraft": true,
                            snippet: {
                                "videoId": _id,
                                "trackKind": 'ASR',
                                "language": 'en',
                                "name": ' ',
                                "isDraft": true,
                            }
                        }
                    }, (err, data) => {
                        console.log(err);
                        console.log("Done Captioning");
                        resolve()
                    });
                    console.log(data);
                    console.log("Done Uploading");
                });

                var _i = setInterval(function() {
                    Logger.log(`${prettyBytes(req.req.connection._bytesDispatched)} bytes uploaded.`);
                }, 250);

            })
        }, { concurrency: 1 }).then(() => { process.exit() })
    });
});