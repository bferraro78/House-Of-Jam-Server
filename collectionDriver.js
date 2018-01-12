var ObjectID = require('mongodb').ObjectID;

CollectionDriver = function(db) {
  this.db = db;
};

// Prototype creates a class method
CollectionDriver.prototype.getCollection = function(collectionName, callback) {
  this.db.collection(collectionName, function(error, the_collection) {
    if( error ) callback(error);
    else callback(null, the_collection);
  });
};

// Returns an array of the collect (session objects...)
CollectionDriver.prototype.findAll = function(collectionName, callback) {
    this.getCollection(collectionName, function(error, the_collection) { 
      if( error ) callback(error);
      else {
        the_collection.find().toArray(function(error, results) { 
          if( error ) callback(error);
          else callback(null, results);
        });
      }
    });
};

// Returns an array of all userNames
CollectionDriver.prototype.findAllUserNames = function(callback) {
    this.getCollection("accounts", function(error, the_collection) { 
      if( error ) callback(error);
      else {
        the_collection.find().toArray(function(error, results) { 
          if( error ) callback(error);
          else { 
            var userNameResults = [];
            const mapUN = results.map(accObj => userNameResults.push(accObj["userName"])); // gather only userNames
            callback(null, userNameResults); 
          }
        });
      }
    });
};

CollectionDriver.prototype.get = function(collectionName, id, callback) {
    this.getCollection(collectionName, function(error, the_collection) {
        if (error) callback(error);
        else {
          if (collectionName == "accounts") {
            the_collection.findOne({'userName':id}, function(error,doc)  { 
              // console.log(id); // in this case it searches by the username
                if (error) callback(error);
                else callback(null, doc);
            });
          } else { // for markers searchs by 
            var checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$"); 
            if (!checkForHexRegExp.test(id)) callback({error: "invalid id"});
            else the_collection.findOne({'_id':ObjectID(id)}, function(error,doc) { 
                if (error) callback(error);
                else callback(null, doc);
            });
          }
        }
    });
};

// Get one jam based on hostName -- used in DBControls script
CollectionDriver.prototype.getJamWithHost = function(collectionName, id, callback) {
    this.getCollection(collectionName, function(error, the_collection) {
        if (error) callback(error);
        else {
          the_collection.findOne({'sessionHostName':id}, function(error,doc)  { 
              if (error) callback(error);
              else callback(null, doc);
          }); 
        }
    });
};

//save new object
CollectionDriver.prototype.save = function(collectionName, obj, callback) {
    this.getCollection(collectionName, function(error, the_collection) { 
      if( error ) callback(error)
      else {
        obj.created_at = new Date(); 
        the_collection.insert(obj, function() { 
          	callback(null, obj);
        });
      }
    });
};

//update a specific object
CollectionDriver.prototype.update = function(collectionName, obj, entityId, callback) {
    this.getCollection(collectionName, function(error, the_collection) {
        if (error) callback(error);
        else {
            obj._id = ObjectID(entityId); // convert to a real obj id
            obj.updated_at = new Date(); 
            the_collection.save(obj, function(error,doc) { 
                if (error) callback(error);
                else callback(null, obj);
            });
        }
    });
};

//delete a specific object
CollectionDriver.prototype.delete = function(collectionName, entityId, callback) {
  var self = this;
  this.getCollection(collectionName, function(error, the_collection) {
    if (error) callback(error);
    else {
      self.get(collectionName, entityId, function(error, objs) {
        var objectToDelete = objs;
        if (error) callback(error);
          else {
            the_collection.remove({'_id':ObjectID(entityId)}, function(error,doc) { 
              if (error) callback(error);
              else callback(null, objectToDelete);
          });
        } 
      }); 
    }
  });
};

// Only done through DBControls.js
CollectionDriver.prototype.deleteAccount = function(collectionName, entityId, callback) {
  var self = this;
  this.getCollection(collectionName, function(error, the_collection) {
    if (error) callback(error);
    else {
      self.get(collectionName, entityId, function(error, objs) {
        var objectToDelete = objs;
        if (error) callback(error);
          else {
            the_collection.remove({'userName':entityId}, function(error,doc) { 
              if (error) callback(error);
              else callback(null, objectToDelete);
          });
        } 
      }); 
    }
  });
};

exports.CollectionDriver = CollectionDriver;