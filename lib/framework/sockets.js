var http = require("http");
var path = require("path");

var exports = module.exports;

exports.bind = function(socket)
{
    // on first connect, announce the server timestamp
    socket.emit("timestamp", {
        "timestamp": process.env.CLOUDCMS_APPSERVER_TIMESTAMP
    });
};

