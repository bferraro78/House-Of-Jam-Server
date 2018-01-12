/********/
// Server written by Ben Ferraro
// All requests are log to logginLog.txt
/********/

var http = require('http'), https = require('https'), express = require('express'), bodyParser = require('body-parser'), favicon = require('serve-favicon'), 
path = require('path'), fs = require('fs'), apn = require('apn'), basicAuth = require('basic-auth'), crypto = require('crypto'), sha1 = require('sha1'),
ObjectId = require('mongodb').ObjectID;

var MongoClient = require('mongodb').MongoClient,
Server = require('mongodb').Server,
CollectionDriver = require('./collectionDriver').CollectionDriver,
FileDriver = require('./fileDriver').FileDriver,
AccountPicturesDriver = require('./accountPicturesDriver').AccountPicturesDriver,
AccountVideosDriver = require('./accountVideosDriver').AccountVideosDriver,
EntryVideosDriver = require('./entryVideosDriver').EntryVideosDriver,
GridFSBucket = require("mongodb").GridFSBucket,
Grid = require('gridfs-stream');

var app = express(); // create Express.js object

app.use(favicon(path.join(__dirname, 'images', 'theHouseICO.ico'))); // This is the little icon in the tab bar
app.use(express.static('images'));
app.use(express.static('views')); // where express looks for static files, such as images
app.use(express.static('sitePhotos')); // where express looks for static files, such as images
app.set('views', path.join(__dirname, 'views'));
// app.engine('html', require('ejs').renderFile);
// app.set('view engine', 'html'); // html pages!!
app.set('view engine', 'jade'); // jade pages!! 
// app.use(bodyParser.json());  
app.use(bodyParser.json()); // req.body usage!!!
app.use(require('express-status-monitor')());

// Error handling
app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(999).end();
  fs.appendFile("./logginLog.txt", "\n*********************************************\n"+ err +"\n" + err.stack + "\n*********************************************\n"); // write log entry to file
})

/** Logging **/
function getDateTime() {
    var date = new Date();

    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;     
    month = (month < 10 ? "0" : "") + month;
    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return year + "-" + month + "-" + day + " | " + hour + ":" + min + ":" + sec + " | ";
}

var logRequests = function(hash, method, url, reference, ua, ip, dur, resCode) {

    var logTxt = getDateTime();

    var arr = [hash, method, url, reference, ua, ip, dur, resCode];

    for (var i = 0; i < arr.length; i++) {
        if (typeof arr[i] != 'undefined' && arr[i].length != 0) {
          logTxt = logTxt.concat(arr[i] + " | ");
        }
    }
    

    fs.appendFile("../serverLog/logginLog.txt", logTxt+"\n"); // write log entry to file
}
app.use(require('express-request-response-logger')(logRequests)); // Makes logging work



// FOR THE SSL CERT -- WEBSITE WAS LOOKING FOR THIS FILE AT THIS ROUTE
app.get('/.well-known/pki-validation/254EB6A885B3E274157D6428E8B9BFFD.txt', function(req, res) { 
  res.sendFile(__dirname + '/.well-known/pki-validation/254EB6A885B3E274157D6428E8B9BFFD.txt');
});


/** Checks every request for a certain aspect **/
function checkAuth(req, res, next) {
 // REMOVED FOR GIT PURPOSES
}

/** Mongo DB setup **/
var mongoHost = 'localHost'; // CHANGE THESE WHEN ACCESSING A SERVER ON A DIFFERENT MACHINE (localHost is this machine)
var mongoPort = 27017; // on the other machine, change 'localHost' to this computers (or whichever computer is hosting the mongo server) static IP address given out by the router

var fileDriver;
var collectionDriver;
var accountPicturesDriver;
var accountVideosDriver;
var entryVideosDriver;
var bucket;

var url = "mongodb://" + mongoHost + ":" + mongoPort; // mongodb://localHost:27017

var mongoClient = new MongoClient(new Server(mongoHost, mongoPort)); 
mongoClient.connect(url, function(err, mongoclient) { 
  if (!mongoClient) {
      console.error("Error! Exiting... Must start MongoDB first");
      process.exit(1); 
  }

  var db = mongoclient.db("HouseofJam");
  bucket = new GridFSBucket(mongoclient);
  fileDriver = new FileDriver(db);
  collectionDriver = new CollectionDriver(db); 
  accountPicturesDriver = new AccountPicturesDriver(db);
  accountVideosDriver = new AccountVideosDriver(db, bucket);
  entryVideosDriver = new EntryVideosDriver(db, bucket);
}); 

// For apple push notifications (keys/team id found on apple dev account)
const apnProvider = new apn.Provider({
  // REMOVED FOR GIT PURPOSES
  production: true, // production mode for APN!
});

// ISSUE HERE IS -- account is only updated to 0 badges in viewDidLoad - ViewController
// this may result in an incorrect badge number...
// For apple push notifications
app.post('/sendNotification', checkAuth, (req, res) => {
    const deviceToken = req.body.token;
    const message = req.body.message; // "Invited to jam by 'UN' -- 'startime', 'Activity' "
    const payloadTmp = req.body.payload; // Jam(session) ID

    // console.log(message);
    // console.log(payloadTmp);
    // console.log(deviceToken);

    var badge;
    var arr = payloadTmp.split("|");
    const payload = arr[0];
    const userName = arr[1];

      // Update badge # for each account -- badge sent will be the number put on the actually app icon
      collectionDriver.get("accounts", userName, function(error, objs) { 
          if (error) {  }
              else { 
                var ogBadge = objs["badgeNum"];
                objs["badgeNum"] = ogBadge+1;
                badge = objs["badgeNum"];
                const notification = new apn.Notification();
                notification.topic = 'com.ferraro.Jam';
                notification.expiry = Math.floor(Date.now() / 1000) + 3600;
                notification.sound = 'ping.aiff';
                notification.alert = { message };
                notification.payload = { payload };
                notification.contentAvailable = 1; 
                notification.badge = badge; 
                apnProvider.send(notification, deviceToken).then((result) => {

                  // update the DB
                  // objs = whole object with updated badge num
                  collectionDriver.update("accounts", objs, objs["_id"], function(error, obj) {   
                  });

                  apnProvider.shutdown();
                  return res.status(200).send(result)
                  // return result == 200 ? res.status(200).send(result) : res.status(400).end();
              });
            } 
        });
});


/****** SET UP ROUTES ******/
    
/* Saving videos and photos */
// For saving session rail/prize pictures
app.post('/files', checkAuth, function(req, res) { fileDriver.handleUploadRequest(req,res); });
app.get('/files/:id', checkAuth, function(req, res) { fileDriver.handleGet(req,res); });

// For saving Account Profile Pictures
app.post('/accountPictures', function(req,res) { accountPicturesDriver.handleUploadRequestAccount(req ,res); });
app.get('/accountPictures/:id', checkAuth, function(req, res) { accountPicturesDriver.handleGetAccount(req,res); });
  
// For saving Account Profile Videos 
app.post('/accountVideos', checkAuth, function(req, res) { accountVideosDriver.handleUploadRequestAccountVideo(req, res);  });
app.get('/accountVideos/:id', checkAuth, function(req, res) { accountVideosDriver.handleGetAccountVideo(req,res); });

// For saving/loading entries
app.post('/entryVideos', checkAuth, function(req, res) { entryVideosDriver.handleUploadRequestEntryVideo(req,res); });
app.get('/entryVideos/:id', checkAuth, function(req, res) { entryVideosDriver.handleGetEntryVideo(req,res); });

/** POST **/
// Add data
app.post('/:collection', checkAuth, function(req, res) { 
  var object = req.body; // JSON object to save (account, marker, etc..)
  var collection = req.params.collection;

    collectionDriver.save(collection, object, function(err, docs) {
      if (err) { res.status(400).send(err); } 
      else { 

        // Update host's accountSessionID here
        if (collection == "markers") {
          collectionDriver.get("accounts", object["sessionHostName"], function(error, objAccount) { 
            if (error) { 
            } else { 

              // Add sessionID to list of hosted jams
              var seshID = object["_id"];
              objAccount["accountSessionID"].push(seshID); 

              collectionDriver.update("accounts", objAccount, objAccount["_id"], function(error, obj) {   
                // do nothing, account was updated!
              });
          }
          }); 
        }

        res.status(200).send(docs); 
      }
    });
});

// Add Entry
app.post('/onlineEntries/:userName', checkAuth, function(req, res) { 
  var object = req.body; // JSON object to save (account, marker, etc..)  
  var userName = req.params.userName;

    // Save entry object
    collectionDriver.save("onlineEntries", object, function(err, docs) {
      if (err) { res.status(400).send(err); } 
      else { 

        // Update host's points/submission total here
        collectionDriver.get("accounts", userName, function(error, objAccount) { 
          if (error) { 
          } else { 
            
            objAccount["dailySubmissionNumber"] = objAccount["dailySubmissionNumber"] + 1; // Update users dalySubmissionNumber by 1
            objAccount["totalPoints"] = objAccount["totalPoints"] + 10; // give user 10 points

            collectionDriver.update("accounts", objAccount, objAccount["_id"], function(error, obj) {   
              // do nothing, account was updated!
            });
        }
        }); 

        res.status(200).send(docs); 
      }
    });
});

/** GET **/

// :collection will cover for anything that is not files or accountPictures
// In this case it is used for: session objects (aka markers), account objects

// req (request) - The request contains information from the browser:
//                  HTTP agent, information passed in and more
// res (response) -  The response is what we will send back to the user
app.get('/:collection', checkAuth, function(req, res) { 
  var params = req.params;   
  collectionDriver.findAll(req.params.collection, function(error, objs) { 
     if (error) { res.status(400).send(error); } 
     else { 
         if (req.accepts('html')) { 
             // res.render('data',{objects: objs, collection: req.params.collection}); 
         } else {
            res.status(200).send(objs);
        }
    }
  });
});

function contains(needle, arr) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === needle) {
      return true;
    }
  }
  return false;
}

// Searching for Accounts
app.get('/searchAccounts/:searchUserName', checkAuth, function(req, res) {
  var params = req.params;
  var searchUserName = params.searchUserName;

  var lowerSearchUN = searchUserName.toLowerCase();
  var PerfectMatch = [];
  var PerfectMatchBool = false; 
  var PerfectMatchUN;
  var LikelyMatch = [];

  if (searchUserName) {
    // Get all Accounts
    collectionDriver.findAllUserNames(function(error, allUN) { 
      if (error) { res.status(400).send(error); } 
      else {

        // Go through all results and return all userNames with the search userName
        var PerfectMatch = []; // only one name allowed in here
        var closeUN = [];
        for (var i = 0; i < allUN.length; i++) {
          var indexUN = allUN[i];

          if (indexUN === searchUserName) { // Perfect Match! 
            PerfectMatchBool = true;
            PerfectMatchUN = indexUN;
            break;
          } else {

            var lowerIndexUN = indexUN.toLowerCase();

            if (!contains(indexUN, LikelyMatch)) {
              if (lowerIndexUN.indexOf(lowerSearchUN) == 0) { // search name is inside of lowerIndexUN
                LikelyMatch.push(indexUN);
              } else if (lowerSearchUN.indexOf(lowerIndexUN) == 0) {
                LikelyMatch.push(indexUN);
              }
            }

            // Only return 10 names
            if (LikelyMatch.length == 10) {
              break;
            }

          }
        } 

        if (PerfectMatchBool) { // perfect match
          collectionDriver.get("accounts", PerfectMatchUN, function(error, foundAcc) {
              if (error) { res.status(400).send(error); }
              else {
                PerfectMatch.push(foundAcc);
                res.status(901).send(PerfectMatch);
                return 0;
              } 
          });
        } else {
          // Return Likely matches...
          res.status(902).send(LikelyMatch);
        }
      }
    });
  } else {
      res.status(400).send({error: 'bad url', url: req.url});
  }
});

app.get('/:collection/:entity', checkAuth, function(req, res) {
  var params = req.params;
  var entity = params.entity;
  var collection = params.collection;

    if (entity) {
        collectionDriver.get(collection, entity, function(error, objs) {
            if (error) { res.status(400).send(error); }
            else { res.status(200).send(objs); } 
        });
    } else {
        res.status(400).send({error: 'bad url', url: req.url});
    }
});


/* Route for initial log in, used for loading accounts */
app.get('/accounts/:entity/:initialLoad', checkAuth, function(req, res) {
  var params = req.params;
  var entity = params.entity;
  var initialLoad = params.initialLoad;

  if (entity) {
      collectionDriver.get("accounts", entity, function(error, objs) { 
        if (objs == null || error) {
            res.status(400).send(error);

        } else {

          if (initialLoad === "yes") {
            // get dailyMessage
            collectionDriver.findAll("dailyMessage", function(errorDM, DMObj) { 

              if (errorDM) {
                objs["message"] = "Could not retrieve daily message";
              } else {
                objs["message"] = DMObj[DMObj.length - 1]["message"];
              }

              // account found, send 
              res.status(200).send(objs);

            });
          } else { // initialLoad = "no"
            // account found, send
            res.status(200).send(objs);
        }
    }

});
  } else {
      res.status(400).send({error: 'bad url', url: req.url});
  }
});


/** PUT **/

// Editing jam info
app.put('/markers/:jamID', checkAuth, function(req, res) { 
    var params = req.params;
    var jamID = params.jamID; // Name of object retrieved from collection (DB) - userName, _id, etc..
    var collection = "markers"; // Table Name (Accounts, JamLocations, etc.)

    collectionDriver.get(collection, jamID, function(error, oldJam) { 
        if (!error || oldJam == null) {
            var updatedJam = req.body;

            // Update all "editable" fields of a session object in oldJam using updatedJam sent from user

            oldJam["jamName"] = updatedJam["jamName"];
            oldJam["startTime"] = updatedJam["startTime"];
            oldJam["entryFee"] = updatedJam["entryFee"];
            oldJam["sessionDescription"] = updatedJam["sessionDescription"];
            oldJam["jamDate"] = updatedJam["jamDate"];
            oldJam["invitedFriends"] = updatedJam["invitedFriends"];
            oldJam["privateJam"] = updatedJam["privateJam"];

            var picIDArr = updatedJam["sessionPictureIDs"];
            for (var i = 0; i < picIDArr.length; i++) {
                oldJam["sessionPictureIDs"].push(picIDArr[i]); // add new ID's
            }

    
            // Update the Jam object in DB
            collectionDriver.update(collection, oldJam, jamID, function(error, objOldJam) { 
                if (error) { res.status(400).send(error); }
                else { res.status(200).send(objOldJam); } 
            });

        } else {
            res.status(400).send(error);
        }

    });
});

// Add jammer/remove for updating markers 
app.put('/markers/:seshID/:userName/:actionMode', checkAuth, function(req, res) { 
    var params = req.params;
    var seshID = params.seshID; // seshID
    var mainUserName = params.userName; // userName to be added or removed
    var action = params.actionMode // add or remove

    if (seshID) {
      collectionDriver.get("markers", seshID, function(error, objMarker) { 
        if (error || objMarker == null) { 
            // entry not found
            var error = { "message" : "Cannot find Jam" };
            res.status(400).send(error);
        } else { 
            var oldJammerList = objMarker["jammers"];
            
            // Always remove jammer if he/she exists
            for (var i = oldJammerList.length; i >=  0; i--) {
                if (oldJammerList[i] === mainUserName) {
                    oldJammerList.splice(i, 1);
                    break;
                }
            } 

            // Add Jammer, if that was the action
            if (action === "add") {
              oldJammerList.push(mainUserName);
            } 

            objMarker["jammers"] = oldJammerList; // set to new updated jammer list

            collectionDriver.update("markers", objMarker, seshID, function(error, obj) {   
              // do nothing, marker was updated!
          });

            res.status(200).send(objMarker);
        }
    });
  } else {
     var error = { "message" : "Cannot PUT a whole collection" };
     res.status(400).send(error);
 }

});

// Add jammer/remove for updating markers -- FROM WEBSITE 
app.post('/markers/:seshID/:userName/:actionMode', function(req, res) { 
    var params = req.params;
    var seshID = params.seshID; // seshID
    var mainUserName = params.userName; // userName to be added or removed
    var action = params.actionMode // add or remove

    if (seshID) {

      collectionDriver.get("markers", seshID, function(error, objMarker) { 
        if (error || objMarker == null) { 
            // entry not found
            var error = { "message" : "Cannot find Jam" };
            res.status(400).send(error);
        } else { 
            var oldJammerList = objMarker["jammers"];
            
            // Always remove jammer if he/she exists
            for (var i = oldJammerList.length; i>=0; i--) {
                if (oldJammerList[i] === mainUserName) {
                    oldJammerList.splice(i, 1);
                    break;
                }
            } 

            // Add Jammer, if that was the action
            if (action === "add") {
              oldJammerList.push(mainUserName);
            } 

            objMarker["jammers"] = oldJammerList; // set to new updated jammer list

            collectionDriver.update("markers", objMarker, seshID, function(error, obj) {   
              // do nothing, marker was updated!
          });

          res.redirect('/');
            // res.status(200).send(objMarker);
        }
    });
  } else {
     var error = { "message" : "Cannot PUT a whole collection" };
     res.status(400).send(error);
 }

});

// Update videoEntry and the voter/votee information
app.put('/onlineEntries/:entity/:userName/:entryPoster', checkAuth, function(req, res) { 
    var params = req.params;
    var entity = params.entity; // entry ID
    var mainUserName = params.userName; // logged in USER who voted
    var entryPoster = params.entryPoster; // poster of the entry's userName
    
    if (entity) {

      // Update voters account dailyVoteNumber and dole out 1 point
      collectionDriver.get("accounts", mainUserName, function(error, objAccount) { 
          if (error || objAccount == null) { // account can't be null 
          } else { 
            var OGdailyVoteNumber = objAccount["dailyVoteNumber"];
            objAccount["dailyVoteNumber"] = OGdailyVoteNumber + 3;
            objAccount["totalPoints"] = objAccount["totalPoints"] + 1; // 1 point for voting

            collectionDriver.update("accounts", objAccount, objAccount["_id"], function(error, obj) {  

              // This is inside the other account update -- because the entry poster and voter might be the same!! 
              // Update votee's account's totalVideoVote/totalPoints -- right now updateEntry is only called in one place
              collectionDriver.get("accounts", entryPoster, function(error, objVoteeAccount) { 
                if (objVoteeAccount != null) {
                  objVoteeAccount["totalVideoVotes"] = objVoteeAccount["totalVideoVotes"] + 1;
                  objVoteeAccount["totalPoints"] = objVoteeAccount["totalPoints"] + 5; // 5 points for getting a vote

                  collectionDriver.update("accounts", objVoteeAccount, objVoteeAccount["_id"], function(error, obj) {   
                     // do nothing, account was updated!
                  });
                }
              });

           });
        }
      });

      // proceed to update votes of videoEntry object
      collectionDriver.get("onlineEntries", entity, function(error, objEntry) { 
       if (error || objEntry == null) { 
       } else { 
        objEntry["votes"] = objEntry["votes"] + 1; 

        collectionDriver.update("onlineEntries", objEntry, entity, function(error, obj) {   
               // do nothing, entry was updated!
           });

        }
      });

      // Send the OKAY
      var okayTrans = { "message" : "Okay transaction" };
      res.status(200).send(okayTrans); 

  } else {
     var error = { "message" : "Can't update vote" };
     res.status(400).send(error);
 }
});


// Increase win by one for winner, Update Places I've Jammed, and numberOfJamsAttended
app.put('/accounts/:winner/:hostName', checkAuth, function(req, res) {
    var params = req.params;
    var winner = params.winner; // userName of winner
    var hostName = params.hostName; // userName of winner
    var collection = "accounts";


    if (winner && hostName) {
      var jammers = req.body['jammers'];   
      var currentLocation = req.body['currentLocation'];

      // Cycle through all jammers
      for (var j = 0; j < jammers.length; j++) {
        var jammer = jammers[j];

        collectionDriver.get(collection, jammer, function(error, objAccount) {
          if (objAccount != null && error == null) {

            // Add jam location - check if same string is present
            var placesArr = objAccount["placesJammed"];
            var hasNotJammed = true;
            for (var i = 0; i < placesArr.length; i++) {
                if (placesArr[i] == currentLocation) {
                    hasNotJammed = false;
                }
            }

            if (hasNotJammed) { // current location has not been jammed yet -- add it
                objAccount["placesJammed"].push(currentLocation);
            }

            // Add one to numberOfJamsAttended
            objAccount["numberOfSessionsAttended"] = objAccount["numberOfSessionsAttended"] + 1;

            // Update points
            var newPointTotal = objAccount["totalPoints"];
            if (jammers.length >= 3) {
              newPointTotal = newPointTotal + 20; // 20 points for attending a session
            }

            if (objAccount["userName"] == winner) { // winner == "noWinner" if jammer length is less than 4
                objAccount["wins"] = objAccount["wins"] + 1; // and wins
                newPointTotal = newPointTotal + 50; // add 50 points for winner
            } 

            if (objAccount["userName"] == hostName) {
              if (jammers.length >= 4) {
                newPointTotal = newPointTotal + 30; // 30 points for hosting a jam with 4 or more people
              }
            }

            objAccount["totalPoints"] = newPointTotal;

            // Update account with new info
            collectionDriver.update(collection, objAccount, objAccount["_id"], function(error, objs) { 

            });
          }  
        });

      } // end for

      res.status(200).end();

  } else {
     var error = { "message" : "Cannot PUT a whole collection" };
     res.status(400).send(error);
 }
});

// Update data by _id
app.put('/:collection/:entity', checkAuth, function(req, res) { 
    var params = req.params;
    var entity = params.entity; // Name of object retrieved from collection (DB) - userName, _id, etc..
    var collection = params.collection; // Table Name (Accounts, JamLocations, etc.)
 
    if (entity) {

          // must get current total votes from DB first, because the app does not include this value when updating 
          // an account object. Therefore the value would be overwritten
          if (collection == "accounts") {

            collectionDriver.get("accounts", req.body["userName"], function(error, objAccount) {
              if (error || objAccount == null) { res.status(400).send(error); }
              else {  
                req.body["totalVideoVotes"] = objAccount["totalVideoVotes"]; // set account objects totalVideoVote
                req.body["placesJammed"] = objAccount["placesJammed"]; // set places i've jammed
                req.body["wins"] = objAccount["wins"]; // and wins
                req.body["numberOfSessionsAttended"] = objAccount["numberOfSessionsAttended"]; // and number of sessions attended 
                req.body["totalPoints"] = objAccount["totalPoints"];

                collectionDriver.update(collection, req.body, entity, function(error, objs) { 
                  if (error) { res.status(400).send(error); }
                  else { res.status(200).send(objs); } 
                });
              }
            });

          } else { // proceed with update normally

            collectionDriver.update(collection, req.body, entity, function(error, objs) { 
              if (error) { res.status(400).send(error); }
              else { res.status(200).send(objs); } 
          });

        }
    } else {
        var error = { "message" : "Cannot PUT a whole collection" };
        res.status(400).send(error);
    }
});

/** DELETE **/
// Delete data by _id
app.delete('/:collection/:entity', checkAuth, function(req, res) { 
    var params = req.params;
    var entity = params.entity;
    var collection = params.collection;

    if (entity) {
      collectionDriver.delete(collection, entity, function(error, object) { 
        if (error) { res.status(400).send(error); }
        else { 

          // Delete local pic/video file also
          if (collection == "files") { 
              var filePath = './uploads/'+ entity + ".jpeg"; //4
              fs.unlink(filePath, (err) => {
                if (err) {

                } else {
                  // console.log("Deleted files pic");
                }
              });
          } else if  (collection == "accountPictures") {
              var filePath = './accountPictures/'+ entity + ".jpeg"; //4
              fs.unlink(filePath, (err) => {
                if (err) {

                } else {
                  // console.log("Deleted files pic");
                }
              });
          } else if  (collection == "accountVideos") {
              var filePath = './accountVideos/'+ entity + ".mp4"; //4
              fs.unlink(filePath, (err) => {
                if (err) {

                } else {
                  // console.log("Deleted file video");
              }
          });
          } else if (collection == "markers") {
              if (object != null) {
                // Set blank accountSessionID
                collectionDriver.get("accounts", object["sessionHostName"], function(error, objAccount) {
                    if (error) { 
                    } else { 

                    // Remove sessionID
                    for (var i = objAccount["accountSessionID"].length; i >= 0; i--) {
                        var seshID = ObjectId(entity);
                        var accSeshID = ObjectId(objAccount["accountSessionID"][i]);
                        if (accSeshID == entity) { // entity == session objectID
                            objAccount["accountSessionID"].splice(i, 1);
                            break;
                        }
                    }

                    collectionDriver.update("accounts", objAccount, objAccount["_id"], function(error, obj) {
                       // do nothing, account was updated!
                   });
                  }
                });
              } 
          }

          res.status(200).send(object); 
        } //200 b/c includes the original doc
    });
  } else {
    var error = { "message" : "Cannot DELETE a whole collection" };
    res.status(400).send(error);
  }
});



/*** PORT SERVERS ***/

/** SSL CERTs **/
// REMOVED FOR GIT PURPOSES


// **** HTTPS -- cluster! ****
// NOT IN USE


// **** HTTPS -- NO CLUSTER ****
https.createServer(CertOptions, app).listen(app.get('port'), function() {
  console.log('Secure (HTTPS) Express server listening on port ' + " - " + app.get('port'));
  console.log(app.get('env'));
});
