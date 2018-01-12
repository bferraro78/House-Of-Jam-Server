var ObjectID = require('mongodb').ObjectID, 
    fs = require('fs'); //1

FileDriver = function(db) { //2
  this.db = db;
};

FileDriver.prototype.getCollection = function(callback) {
  this.db.collection('files', function(error, file_collection) { // Looks through the 'files' collection
    if( error ) callback(error);
    else callback(null, file_collection);
  });
};

// Find a specific file
FileDriver.prototype.get = function(id, callback) {
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
// 3. Stores the file in the local uploads directory.
// 4. Calls sendfile() on the response object; this method knows how to transfer the file and set the appropriate response headers.
FileDriver.prototype.handleGet = function(req, res) { 
    var fileId = req.params.id;
    if (fileId) {
        this.get(fileId, function(error, thisFile) { 
            if (error) { res.status(400).send(error); }
            else {
                    if (thisFile) {
                         var filename = fileId + thisFile.ext; 
                         var filePath = __dirname + '/uploads/'+ filename; 
    	                 res.sendFile(filePath); 
    	            } else res.status(404).send('file not found');
            }
        });        
    } else {
	    res.status(404).send('file ID not found');
    }
};

//save new file
FileDriver.prototype.save = function(obj, callback) { 
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
FileDriver.prototype.getNewFileId = function(newobj, callback) {
	this.save(newobj, function(err,obj) {
		if (err) { callback(err); } 
		else { callback(null,obj._id); }
	});
};


FileDriver.prototype.handleUploadRequest = function(req, res) { 
    var ctype = req.get("content-type"); 
    var ext = ctype.substr(ctype.indexOf('/')+1); 
    if (ext) {ext = '.' + ext; } else {ext = '';}
    this.getNewFileId({'content-type':ctype, 'ext':ext}, function(err,id) { 
        if (err) { res.status(400).send(err); } 
        else { 	         
            var filename = id + ext; 
            var filePath = __dirname + '/uploads/' + filename; 
            
            var writable = fs.createWriteStream(filePath); 
            req.pipe(writable); 

             req.on('end', function () { 
               res.status(200).send({'_id':id});
             });               
             writable.on('error', function(err) { 
                res.status(500).send(err);
             });
        }
    });
};



exports.FileDriver = FileDriver;