var fs = require('fs'),
assert = require('assert');

AccountVideosDriver = function(db, bucket) { //2
  this.db = db;
  this.bucket = bucket;
};

AccountVideosDriver.prototype.getCollection = function(callback) {
  this.db.collection('accountVideos', function(error, file_collection) { // Looks through the 'accountVideos' collection
    if( error ) callback(error);
    else callback(null, file_collection);
  });
};

// Find a specific file
AccountVideosDriver.prototype.get = function(id, callback) {
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
// 3. Stores the file in the local accountVideos directory.
// 4. Calls sendfile() on the response object; this method knows how to transfer the file and set the appropriate response headers.
AccountVideosDriver.prototype.handleGetAccountVideo = function(req, res) { //1
    var fileId = req.params.id;
    var bucket = this.bucket;

    if (fileId) {
      var filename = fileId + ".mp4"; 
      var filePath = __dirname + '/accountVideos/'+ filename; 

      // Check if file exists before calling gridFS which will throw a stupid error
      if (fs.existsSync(filePath)) { 
        bucket.openDownloadStreamByName(filename).
        pipe(fs.createWriteStream(__dirname + '/gridCopyVideos/'+filename)).
        on('Error', function(error) {
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
      res.status(404).send('fileID not found');
    }
};

//save new file
AccountVideosDriver.prototype.save = function(obj, callback) { //1
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
AccountVideosDriver.prototype.getNewFileId = function(newobj, callback) { //2
	this.save(newobj, function(err,obj) {
		if (err) { callback(err); } 
		else { callback(null, obj._id); } //3
	});
};


AccountVideosDriver.prototype.handleUploadRequestAccountVideo = function(req, res) {
    var ctype = req.get("content-type"); 
    var ext = ctype.substr(ctype.indexOf('/')+1); 
    var bucket = this.bucket;

    if (ext) {ext = '.' + ext; } else {ext = '';}
    this.getNewFileId({'content-type':ctype, 'ext':ext}, function(err,id) { 
        if (err) { res.status(400).send(err); 
        } else {           
          var filename = id + ext; 
          var filePath = __dirname + '/accountVideos/' + filename; 

          var writable = fs.createWriteStream(filePath); 
          req.pipe(writable); 

          req.on('end', function (){ 

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
           writable.on('error', function(err) { 
              res.status(500).send(err);
           });

        }
    });
};



exports.AccountVideosDriver = AccountVideosDriver;