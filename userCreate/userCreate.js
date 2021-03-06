#!/bin/sh

':' // Hack to pass parameters to Node before running this file
':' //; [ -f ~/.pm2/custom_options.sh ] && . ~/.pm2/custom_options.sh || : ; exec "`command -v node || command -v nodejs`" $PM2_NODE_OPTIONS "$0" "$@"


var pg = require('pg');
var uuid = require('node-uuid');
var promise = require('promise');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var process = require('process');
var connection = 'postgres://jolata@127.0.0.1:5432/jolata';

var getUsersQuery = 'select * from users';

var hash = function (secret, nonce) {
  console.log(secret, nonce);
    var hash = crypto.createHash('sha1');
    hash.update(secret + nonce);
    return hash.digest('hex');
};

var dbExecute = function(query, dbConnection, callback){
  pg.connect(dbConnection, function(error, client, done){
    if(client === null) { 
      console.log("No PSQL server, exiting..");
      process.exit(1);
    }
    client.query(query, function(error, results){
      if(error){
        console.log("PSQL ERROR:", error);
      } else {
        callback(results);
      }
    });
    done();
  });
  pg.end();
};

var createUser = function(user, lastID){
  console.log("creating user" + user[0]);
  var now = (new Date()).toISOString();
  var nonce = uuid.v4();
  var newHash = hash(user[1], nonce);
  var column = 'id,name,email,nonce,hash,admin,enabled,ctime,mtime';
  var values = [lastID, user[0], user[2], nonce, newHash, user[3], 1, now, now];
  var query = 'INSERT INTO users (' + column + ') VALUES (\'' + values.join('\',\'') +'\');';
  console.log(query);
  dbExecute(query, connection, function(results){
    console.log(user[0] + " account created..");
  });

};

if(!process.argv[2]){
  console.log("Usage: userCreate.js" + " <users.csv file location>");
  process.exit(1);
} else {
  var csvFile = path.join(__dirname, process.argv[2]);
  var newUsers = fs.readFileSync(csvFile, 'utf8')
                   .split('\n')
                   .map(function(user){
                      return user.replace(/ /g,'').split(',');
                    });
  // if(newUsers[0][0][0] === '#') newUsers.shift();
  if(newUsers[newUsers.length-1] <= 1) newUsers.pop();
  var currentUsers = {};
  dbExecute(getUsersQuery, connection, function(data){
    var lastID = 0;
    data.rows.forEach(function(user){
      if(Number(user.id) > lastID) lastID = user.id;
      currentUsers[user.name] = user;
    });
    newUsers.forEach(function(user){
      if(currentUsers.hasOwnProperty(user[0])){
        console.log(user[0] + " already exists, skipping..");
      } else if( user[0][0] === '#' ){
        return;
      } else {
        createUser(user, ++lastID);
      }
    });
    console.log("UI webserver needs to be restarted before new accounts are accessible");
  });
}




