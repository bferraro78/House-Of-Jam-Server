var crypto = require('crypto'), prompt = require('prompt'), fs = require('fs'), nodemailer = require('nodemailer');


/** Mongo Setup **/
var MongoClient = require('mongodb').MongoClient,
Server = require('mongodb').Server,
CollectionDriver = require('./collectionDriver').CollectionDriver,
FileDriver = require('./fileDriver').FileDriver,
AccountPicturesDriver = require('./accountPicturesDriver').AccountPicturesDriver,
AccountVideosDriver = require('./accountVideosDriver').AccountVideosDriver,
EntryVideosDriver = require('./entryVideosDriver').EntryVideosDriver;

var mongoHost = 'localHost'; // CHANGE THESE WHEN ACCESSING A SERVER ON A DIFFERENT MACHINE (localHost is this machine)
var mongoPort = 27017;

var fileDriver;
var collectionDriver;
var accountPicturesDriver;
var accountVideosDriver;
var entryVideosDriver;

var url = "mongodb://localhost:27017";

var mongoClient = new MongoClient(new Server(mongoHost, mongoPort)); 
mongoClient.connect(url, function(err, mongoclient) { 
  if (!mongoClient) {
      console.error("Error! Exiting... Must start MongoDB first");
      process.exit(0); 
  }

  var db = mongoclient.db("HouseofJam");
  fileDriver = new FileDriver(db);
  collectionDriver = new CollectionDriver(db); 
  accountPicturesDriver = new AccountPicturesDriver(db);
  accountVideosDriver = new AccountVideosDriver(db, null);
  entryVideosDriver = new EntryVideosDriver(db, null);
}); 


function contains(ID, arrID) {
	for (var i = 0; i < arrID.length; i++) {
		if (ID == arrID[i]) {
			return true; // ID is in array
		}
	}
	return false;
}


prompt.start(); // starts promt
 
/* Controls */
console.log('1. - Set Daily Message');
console.log();
// DB/local file clean up
console.log('2. - Clear GridVideos Folder');
console.log('3. - Remove files not in DB (Clean Up DB)');

console.log();  
// Account Resets
console.log('4. - Reset Daily Submission');
console.log('5. - Reset Vote Number');

console.log();
// Account Troubleshoot
console.log('6. - Password Recovery');
console.log('7. - Profile Look Up');  

console.log();
// Dole out weekly entry winners, no clean up for DB/local files 
console.log('10. - Close Weekly Entries');

console.log();
// Delete a Jam
console.log('11. - Delete Jam /w HostName');
console.log('12. - Delete Account');


console.log();
// Stats
console.log('20. - Number of Jams');
console.log('21. - Number of Accounts');

prompt.get(['Action'], function (err, result) { // Ask for Action

	if (result.Action == "1") { // read from a file ./DM.txt

		// NOTE -- DM.txt, write new line characters as "\n", JSON will convert this to
		// "\\n" in the DB. The app then replaces it back to "\n" :)

		fs.readFile('DM.txt', 'utf8', function (err, DM) {
			if (err) {
				console.log(err);
				process.exit(1);
			} else {
				var newDM = {"message" : DM};
				collectionDriver.save("dailyMessage", newDM, function(err, docs) { 
					console.log("New DM Saved");
					process.exit(1);	
				});
			}
		});

	} else if (result.Action == "2") {
		var listOfFiles = [];
		var gridFiles = "./gridCopyVideos/";
		fs.readdirSync(gridFiles).forEach(file => {
			var filePath = gridFiles + file;
			listOfFiles.push(filePath);
		})

		var count = 0;
		for (var i = 0; i < listOfFiles.length; i++) {
  			fs.unlink(listOfFiles[i], (err) => {
  				count++;
  				if (count == listOfFiles.length) {
					process.exit(1);
  				}
  			});
		}
	} else if (result.Action == "3") {
 
		/** Account Videos/Pictures **/

		/* 1. - Get all in-use account Pictures/Videos */
		collectionDriver.findAll("accounts", function(error, accounts) { 

			var inUseAccountPictures = [];
			var inUseAccountVideos = [];
			for (var i = 0; i < accounts.length; i++) {
				var account = accounts[i];
				if (account["accountPictureID"] != '') {
					inUseAccountPictures.push(account["accountPictureID"]);
				}

				// account videos
				for (var j = 0; j < account["featureVideoIDs"].length; j++) {
					var videoID = account["featureVideoIDs"][j];
					if (videoID != '') {
						inUseAccountVideos.push(videoID);						
					}
				}
			}

			// console.log(inUseAccountVideos);
			// console.log(inUseAccountPictures);

			/* 2. - Go through picture/video DB to find files not "inUse" */
			var allAccPictureIDs = [];  // all IDs from accountPictures DB
			var allAccVideoIDs = []; // all IDs from accountVideos DB

			// Account Pictures
			collectionDriver.findAll("accountPictures", function(error, allAccPictures) {
				console.log("Account Pictures"); 

				for (var i = 0; i < allAccPictures.length; i++) {
					var DBpictureID = allAccPictures[i]["_id"];
					allAccPictureIDs.push(DBpictureID);
					if (!contains(DBpictureID, inUseAccountPictures)) { // If DBpictureID is not inUse array, then it must be deleted
						// Delete from DB and delete file
						collectionDriver.delete("accountPictures", DBpictureID, function(error, object) { 
							var filePath = './accountPictures/'+ DBpictureID + ".jpeg";
							fs.unlink(filePath, (err) => { });
						});
					}
				}

				/* 3. - Go through file Directories and now see what files do not exists in the Picture DB (accountPictures) */
				var dir = "./accountPictures/";
				fs.readdirSync(dir).forEach(file => {
  					var onlyID = file.substring(0, file.indexOf('.'));
  					if (!contains(onlyID, allAccPictureIDs)) {
						var filePath = dir + onlyID + ".jpeg";
						fs.unlink(filePath, (err) => { });
  					}
				});
			});

			// Account Videos
			collectionDriver.findAll("accountVideos", function(error, allAccVideos) { 
				console.log("Account Videos");

				for (var i = 0; i < allAccVideos.length; i++) {
					var DBvideoID = allAccVideos[i]["_id"];
					allAccVideoIDs.push(DBvideoID);
					if (!contains(DBvideoID, inUseAccountVideos)) { // If DBvideoID is not inUse array, then it must be deleted
						// Delete from DB and delete file
						collectionDriver.delete("accountVideos", DBvideoID, function(error, object) { 
							var filePath = './accountVideos/'+ DBvideoID + ".mp4";
							fs.unlink(filePath, (err) => { });
						});
					}
				}

				/* 3. - Go through file Directories and now see what files do not exists in the video DB (accountVideos) */
				var dir = "./accountVideos/";
				fs.readdirSync(dir).forEach(file => {
  					var onlyID = file.substring(0, file.indexOf('.'));
  					if (!contains(onlyID, allAccVideoIDs)) {
						var filePath = dir + onlyID + ".mp4";
						fs.unlink(filePath, (err) => { });
  					}
				});
			});
		});

		/** Markers **/

		/* 1. - Get all in-use Jam Pictures */
		var inUseJamPictures = [];
		collectionDriver.findAll("markers", function(error, jams) {
			var inUseMarkerPictures = [];
			for (var i = 0; i < jams.length; i++) { 
				var jam = jams[i];

				for (var j = 0; j < jam["sessionPictureIDs"].length; j++) {
					var pictureID = jam["sessionPictureIDs"][j];
					if (pictureID != '') {
						inUseJamPictures.push(pictureID);						
					}
				}
			}

			/* 2. - Go through jam pictures DB to find files not "inUse" */
			var allJamPictureIDs = [];  // all IDs from accountPictures DB
			collectionDriver.findAll("files", function(error, allJamPictures) {
				console.log("Jam Photos");

				for (var i = 0; i < allJamPictures.length; i++) {
					var DBJamPictureID = allJamPictures[i]["_id"];
					allJamPictureIDs.push(DBJamPictureID);
					if (!contains(DBJamPictureID, inUseJamPictures)) { // If DBJamPictureID is not inUse array, then it must be deleted
						// Delete from DB and delete file
						collectionDriver.delete("files", DBJamPictureID, function(error, object) { 
							var filePath = './uploads/'+ object["_id"] + ".jpeg";
							console.log("From files" + filePath);
							fs.unlink(filePath, (err) => { });
						});
					}
				}

				// console.log(allJamPictureIDs);

				/* 3. - Go through file Directories and now see what files do not exists in the Jam Picture DB (files) */
				var dir = "./uploads/";
				fs.readdirSync(dir).forEach(file => {
  					var onlyID = file.substring(0, file.indexOf('.'));
  					if (!contains(onlyID, allJamPictureIDs)) {
						var filePath = dir + onlyID + ".jpeg";
						console.log(filePath);
						fs.unlink(filePath, (err) => { });
  					}
				});

			});
		});
	} else if (result.Action == "4") { // Reset daily Submission Number to 0 (daily reset)
		console.log('Action: Reset Daily Submission');

		collectionDriver.findAll("accounts", function(error, accArr) { 
			var count = 0;
			for (var i = 0; i < accArr.length; i++) {
				var account = accArr[i]; // get account
				account["dailySubmissionNumber"] = 0;
				
				// Update account
				collectionDriver.update("accounts", account, account["_id"], function(error, objs) { 
					count +=1;
					if (count == accArr.length) {
						process.exit(1);
					}
				});
			}
		});
	} else if (result.Action == "5") { // Reset daily vote number to 0 (weekly reset)
		console.log('Action: Reset Vote Number');

		collectionDriver.findAll("accounts", function(error, accArr) {
			var count = 0;
			for (var i = 0; i < accArr.length; i++) {
				var account = accArr[i]; // get account
				account["dailyVoteNumber"] = 0;	
				
				// Update account
				collectionDriver.update("accounts", account, account["_id"], function(error, objs) { 
					count +=1;
					if (count == accArr.length) {
						process.exit(1);
					}
				});
			}
		});


	} else if (result.Action == "7") { // Profile look up through username 
		/* PW Recovery */
		prompt.get(['userName'], function (err, resultAcc) {
			var userName = resultAcc.userName;
			collectionDriver.get("accounts", userName, function(error, account) {
				console.log(account);
				process.exit(0);
			}); 
		});
	} else if (result.Action == "11") { // Delete Jam based on hostname
		/* Get Hostname */
		prompt.get(['HostName'], function (err, jam) {
			var hostName = jam.HostName;
			collectionDriver.getJamWithHost("markers", hostName, function(error, jam) {
				if (jam != null) {
					collectionDriver.get("accounts", hostName, function(error, account) {
						if (account) { // account is non null
							account["accountSessionID"] = ""; // set to blank

							// update account
							collectionDriver.update("accounts", account, account["_id"], function(error, objs) { 
							});

						}

						var filesToDelete = [];
						// Delete all associated pictures
						for (var i = 0; i < jam["sessionPictureIDs"].length; i++) {
							var picID = jam["sessionPictureIDs"][i];
							var picName = picID + ".jpeg";
							var picFilePath = "./uploads/" + picName; 
							filesToDelete.push(picFilePath); // to delete later
							collectionDriver.delete("files", picID, function(error, object) {  }); // delete from DB
						}

						// Delete Jam from DB
						collectionDriver.delete("markers", jam["_id"], function(error, object) { });

							// Delete Local Files
							for (var i = 0; i < filesToDelete.length; i++) {
								var picFilePath = filesToDelete[i];
								fs.unlink(picFilePath, (err) => { });
							}

						});
				} else {
					console.log("No Jam available");
					process.exit(0);
				}
			});  
		});

	} else if (result.Action == "12") { // delete account
		/* Get Username */
		prompt.get(['username'], function (err, jam) {
			var username = jam.username;
			collectionDriver.deleteAccount("accounts", username, function(error, account) {

				// Account videos and pictures will be deleted with option 3
				// Online entries won't go through because the account will be null
				// If the account is signed up for a jam, the updating the account will also fail safely when the Jam is ended
				if (account) {
					console.log(username + " Deleted!");
					process.exit(1);
				} else {
					console.log("Could not find " + username);
					process.exit(0);
				}
			});
		});
	} else if (result.Action == "10") { // Dole out 40 points to the winners (weekly reset)
										// Tie in votes goes to the person who sent their entry first!!
		console.log('Action: Close Weekly Entries');

		collectionDriver.findAll("onlineEntries", function(error, entriesArr) { 
			if (entriesArr.length != 0) {
				for (var i = 0; i < entriesArr.length; i+=3) { // cycle through in sections of 3
					if (i+3 <= entriesArr.length-1) {
						 // currentEntry = 0-2, for cycleing through each group
						 var highVote = -1;
						 var winner;
						for (var currentEntry = 0; currentEntry < 3; currentEntry++) {
							var entry = entriesArr[i+currentEntry]; // get entry
							var votes = entry["votes"];
							
							console.log(votes);

							if (votes > highVote) {
								highVote = votes; // set new highvote
								winner = entry["username"];
							}
						}

						// Update winning account
						collectionDriver.get("accounts", winner, function(error, account) {
							if (account != null) {
								account["totalPoints"] = account["totalPoints"] + 40; 
								// Update account
								collectionDriver.update("accounts", account, account["_id"], function(error, objs) { });

								// Send Email to userName
								var email = account["email"];
								var UN = account["userName"];

								console.log("Users email" + email);
							}
						});
					}
				} // end for loop
			} else {
				console.log("No Entries to close");
				process.exit(1);
			}
		});
	} else if (result.Action == "6") { // Gets users password
		console.log('Action: Decrypt Password');

		// REMOVED FOR GIT PURPOSES

	} else if (result.Action == "100") { // lots of jams test
		// for (var i = 0; i < 100; i++) {
		// 	var lat = getRandomArbitrary(1, 89);
		// 	var longi = getRandomArbitrary(1, 179);

		// 			var jamTest = { jamDate: '08-12-2017',
		// 			  sessionLong: longi.toString(),
		// 			  sessionHostName: 'daga',
		// 			  invitedFriends: [],
		// 			  jamType: 'Biking',
		// 			  entryFee: '',
		// 			  jamName: '',
		// 			  sessionDescription: '',
		// 			  jamLocation: 'North Castle,United States,41.149142,-73.704486',
		// 			  sessionPictureIDs: [],
		// 			  privateJam: 'public',
		// 			  LorC: 'leisure',
		// 			  jammers: [ 'daga' ],
		// 			  startTime: 'jj',
		// 			  sessionLat: lat.toString() };

		// 	collectionDriver.save("markers", jamTest, function(err, docs) {



		// 	});
		// }
	} else if (result.Action == "20") {
		collectionDriver.findAll("markers", function(error, jams) {
			console.log(jams.length);
			process.exit(1); 
		});
	} else if (result.Action == "21") {
		collectionDriver.findAll("accounts", function(error, accounts) { 
			console.log(accounts.length); 
			process.exit(1);
		});
	} else {
		console.log("Invalid Action -- Goodbye");
		process.exit(0);
	}

});

function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}