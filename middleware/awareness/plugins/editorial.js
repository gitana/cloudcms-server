exports = module.exports = {};

var util = require("../../../util/util");
var socketUtil = require("../../../util/socket");

var request = require("request");

var http = require("http");
var https = require("https");

exports.bindSocket = function(socket, provider)
{
    socketUtil.bindGitana(socket, function() {

        socket.on("acquireEditorialSession", function(sessionKey, repositoryId, branchId, callback) {
            acquireEditorialSession(socket, provider, sessionKey, repositoryId, branchId, callback);
        });

        socket.on("releaseEditorialSession", function(sessionKey, repositoryId, branchId, callback) {
            releaseEditorialSession(socket, provider, sessionKey, repositoryId, branchId, callback);
        });

        socket.on("commitEditorialSession", function(sessionKey, repositoryId, branchId, callback) {
            commitEditorialSession(socket, provider, sessionKey, repositoryId, branchId, callback);
        });

        socket.on("editorialSessionInfo", function(sessionKey, repositoryId, branchId, callback) {
            editorialSessionInfo(socket, provider, sessionKey, repositoryId, branchId, callback);
        });

        var acquireEditorialSession = function(socket, provider, sessionKey, repositoryId, branchId, callback)
        {
            // send an HTTP command to acquire an editorial session for this repository and branch
            var URL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT) + "/oneteam/session/acquire";

            var headers = {};
            //headers["Authorization"] = socket.gitana.platform().getDriver().getHttpHeaders()["Authorization"];
            var gitanaTicket = extractTicket(socket);
            if (gitanaTicket)
            {
                headers["GITANA_TICKET"] = gitanaTicket;
            }

            var json = {};
            json.repositoryId = repositoryId;
            json.branchId = branchId;
            json.key = sessionKey;

            var agent = http.globalAgent;
            if (process.env.GITANA_PROXY_SCHEME === "https")
            {
                agent = https.globalAgent;
            }

            request({
                "method": "POST",
                "url": URL,
                "qs": {},
                "json": json,
                "headers": headers,
                "agent": agent,
                "timeout": process.defaultHttpTimeoutMs
            }, function(err, response, body) {

                if (err || (response && response.body && response.body.error)) {
                    return callback(err);
                }

                callback(null, body._doc);
            });
        };
    });

    var releaseEditorialSession = function(socket, provider, sessionKey, repositoryId, branchId, callback)
    {
        // send an HTTP command to release the session
        var URL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT) + "/oneteam/session/release";

        var json = {};
        json.repositoryId = repositoryId;
        json.branchId = branchId;
        json.key = sessionKey;

        var headers = {};
        //headers["Authorization"] = socket.gitana.platform().getDriver().getHttpHeaders()["Authorization"];
        var gitanaTicket = extractTicket(socket);
        if (gitanaTicket)
        {
            headers["GITANA_TICKET"] = gitanaTicket;
        }

        var agent = http.globalAgent;
        if (process.env.GITANA_PROXY_SCHEME === "https")
        {
            agent = https.globalAgent;
        }

        request({
            "method": "POST",
            "url": URL,
            "qs": {},
            "json": json,
            "headers": headers,
            "agent": agent,
            "timeout": process.defaultHttpTimeoutMs
        }, function(err, response, body) {

            if (err || (response && response.body && response.body.error)) {
                return callback(err);
            }

            callback();
        });
    };

    var commitEditorialSession = function(socket, provider, sessionKey, repositoryId, branchId, callback)
    {
        // send an HTTP command to commit the session

        var URL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT) + "/oneteam/session/commit";

        var json = {};
        json.repositoryId = repositoryId;
        json.branchId = branchId;
        json.key = sessionKey;

        var headers = {};
        //headers["Authorization"] = socket.gitana.platform().getDriver().getHttpHeaders()["Authorization"];
        var gitanaTicket = extractTicket(socket);
        if (gitanaTicket)
        {
            headers["GITANA_TICKET"] = gitanaTicket;
        }

        var agent = http.globalAgent;
        if (process.env.GITANA_PROXY_SCHEME === "https")
        {
            agent = https.globalAgent;
        }

        request({
            "method": "POST",
            "url": URL,
            "qs": {},
            "json": json,
            "headers": headers,
            "agent": agent,
            "timeout": process.defaultHttpTimeoutMs
        }, function(err, response, body) {

            if (err || (response && response.body && response.body.error)) {
                return callback(err);
            }

            callback(null, body);
        });
    };

    var editorialSessionInfo = function(socket, provider, sessionKey, repositoryId, branchId, callback)
    {
        // send an HTTP command to commit the session

        var URL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT) + "/oneteam/session/info";

        var json = {};
        json.repositoryId = repositoryId;
        json.branchId = branchId;
        json.key = sessionKey;

        var headers = {};
        //headers["Authorization"] = socket.gitana.platform().getDriver().getHttpHeaders()["Authorization"];
        var gitanaTicket = extractTicket(socket);
        if (gitanaTicket)
        {
            headers["GITANA_TICKET"] = gitanaTicket;
        }

        var agent = http.globalAgent;
        if (process.env.GITANA_PROXY_SCHEME === "https")
        {
            agent = https.globalAgent;
        }

        request({
            "method": "POST",
            "url": URL,
            "qs": {},
            "json": json,
            "headers": headers,
            "agent": agent,
            "timeout": process.defaultHttpTimeoutMs
        }, function(err, response, body) {

            if (err || (response && response.body && response.body.error)) {
                return callback(err);
            }

            callback(null, body);
        });
    };

    var extractTicket = function(socket)
    {
        var ticket = null;

        if (socket.handshake && socket.handshake.headers)
        {
            var cookieValue = socket.handshake.headers.cookie;
            if (cookieValue)
            {
                var x1 = cookieValue.indexOf("GITANA_TICKET=");
                if (x1 > -1)
                {
                    var x2 = cookieValue.indexOf(";", x1 + 14);
                    if (x2 > -1)
                    {
                        ticket = cookieValue.substring(x1 + 14, x2);
                    }
                }
            }
        }

        return ticket;
    }

};
