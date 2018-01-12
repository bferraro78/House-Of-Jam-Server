var ObjectID = require('mongodb').ObjectID, 
    fs = require('fs'); //1

AccountPicturesDriver = function(db) { //2
  this.db = db;
};

AccountPicturesDriver.prototype.getCollection = function(callback) {
  this.db.collection('accountPictures', function(error, file_collection) { // Looks through the 'files' collection
    if( error ) callback(error);
    else callback(null, file_collection);
  });
};

// Find a specific file
AccountPicturesDriver.prototype.get = function(id, callback) {
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
// 3. Stores the file in the local accountPictures directory.
// 4. Calls sendfile() on the response object; this method knows how to transfer the file and set the appropriate response headers.
AccountPicturesDriver.prototype.handleGetAccount = function(req, res) { //1
    var fileId = req.params.id;
    if (fileId) {
        this.get(fileId, function(error, thisFile) { //2
            if (error) { res.status(400).send(error); }
            else {
                    if (thisFile) {
                        var filename = fileId + thisFile.ext; //3
                        var filePath = __dirname + '/accountPictures/'+ filename; //4
                        res.sendFile(filePath); //5
                  } else res.status(404).send('file not found');
            }
        });        
    } else {
      res.status(404).send('file not found');
    }
};

//save new file
AccountPicturesDriver.prototype.save = function(obj, callback) { //1
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
AccountPicturesDriver.prototype.getNewFileId = function(newobj, callback) { //2
	this.save(newobj, function(err,obj) {
		if (err) { callback(err); } 
		else { callback(null,obj._id); } //3
	});
};


AccountPicturesDriver.prototype.handleUploadRequestAccount = function(req, res) { //1
    var ctype = req.get("content-type"); //2
    var ext = ctype.substr(ctype.indexOf('/')+1); //3
    if (ext) {ext = '.' + ext; } else {ext = '';}
    this.getNewFileId({'content-type':ctype, 'ext':ext}, function(err,id) { //4
        if (err) { res.status(400).send(err); } 
        else {           
            var filename = id + ext; //5
            var filePath = __dirname + '/accountPictures/' + filename; //6
            
           var writable = fs.createWriteStream(filePath); //7
           req.pipe(writable); //8
             req.on('end', function (){ //9
                res.status(200).send({'_id':id});
             });
             writable.on('error', function(err) { //10
                res.status(500).send(err);
             });
        }
    });
};



exports.AccountPicturesDriver = AccountPicturesDriver;