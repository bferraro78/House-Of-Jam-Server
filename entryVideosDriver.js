var ObjectID = require('mongodb').ObjectID, 
    fs = require('fs'); //1

EntryVideosDriver = function(db , bucket) { //2
  this.db = db;
  this.bucket = bucket;
};

EntryVideosDriver.prototype.getCollection = function(callback) {
  this.db.collection('entryVideos', function(error, file_collection) { // Looks through the 'files' collection
    if( error ) callback(error);
    else callback(null, file_collection);
  });
};

// Find a specific file
EntryVideosDriver.prototype.get = function(id, callback) {
    this.getCollection(function(error, file_collection) { //1
        if (error) callback(error);
        else {
            var checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$"); //2
            if (!checkForHexRegExp.test(id)) callback({error: "invalid id"});
            else file_collection.findOne({'_id':ObjectID(id)}, function(error,doc) { //3
                if (error) callback(error);
                else callback(null, doc);
            });
        }
    });
};

// It simplifies the server code by abstracting the file handling away from index.js
// 1. Fetches the file entity from the database via the supplied id.
// 2. Adds the extension stored in the database entry to the id to create the filename.
// 3. Stores the file in the local entryVideos directory.
// 4. Calls sendfile() on the response object; this method knows how to transfer the file and set the appropriate response headers.
EntryVideosDriver.prototype.handleGetEntryVideo = function(req, res) { //1
    var fileId = req.params.id;
    var bucket = this.bucket;

    if (fileId) {
     var filename = fileId + ".mp4";
     var filePath =  __dirname + '/entryVideos/'+ filename;
     var fileExists = false;

      if (!fs.existsSync(filePath)) { // if the video file does not exist, check for jpeg
        filename = fileId + ".jpeg";
        filePath =  __dirname +'/entryVideos/'+ filename;

        if (fs.existsSync(filePath)) {
          fileExists = true;
        }
      } else {
        fileExists = true; 
      }

      if (fileExists) {
        bucket.openDownloadStreamByName(filename).
        pipe(fs.createWriteStream(__dirname +'/gridCopyVideos/'+ filename)).
        on('error', function(error) {
          res.status(404).send('file not found');
          // assert.ifError(error);
        }).
        on('finish', function() {
          // make sure file exists in gridFiles here here
          var gridFilePath = __dirname + '/gridCopyVideos/'+ filename; 
          if (fs.existsSync(gridFilePath)) {
            res.sendFile(__dirname + '/gridCopyVideos/'+ filename); // sending file back              
          } else {
            res.status(404).send('file not found');
          }
        });
      } else {
        res.status(404).send('file not found');
      }
    } else {
      res.status(404).send('file not found');
    }
};

//save new file
EntryVideosDriver.prototype.save = function(obj, callback) { //1
    this.getCollection(function(error, the_collection) {
      if( error ) callback(error);
      else {
        obj.created_at = new Date();
        the_collection.insert(obj, function() {
          callback(null, obj);
        });
      }
    });
};

// A wrapper for save for the purpose of creating a new file entity and returning id alone.
EntryVideosDriver.prototype.getNewFileId = function(newobj, callback) { //2
	this.save(newobj, function(err,obj) {
		if (err) { callback(err); } 
		else { callback(null,obj._id); } //3
	});
};


EntryVideosDriver.prototype.handleUploadRequestEntryVideo = function(req, res) { //1
    var ctype = req.get("content-type"); //2
    var ext = ctype.substr(ctype.indexOf('/')+1); //3
    var bucket = this.bucket;

    if (ext) {ext = '.' + ext; } else {ext = '';}
    this.getNewFileId({'content-type':ctype, 'ext':ext}, function(err,id) { //4
        if (err) { res.status(400).send(err); } 
        else {           
          var filename = id + ext; //5
          var filePath = __dirname + '/entryVideos/' + filename; 
          
          var writable = fs.createWriteStream(filePath); //7
              req.pipe(writable); //8
                req.on('end', function (){ //9

                  fs.createReadStream(filePath).
                          pipe(bucket.openUploadStream(filename)).
                          on('error', function(error) {
                            res.status(500).send(err);
                            // assert.ifError(error); 
                          }).
                          on('finish', function() {
                            res.status(200).send({'_id':id});
                          });
                 });               
                 writable.on('error', function(err) { //10
                    res.status(500).send(err);
                 });
        }
    });
};



exports.EntryVideosDriver = EntryVideosDriver;