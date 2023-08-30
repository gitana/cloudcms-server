exports = module.exports = {};

var util = require("../../../util/util");
var socketUtil = require("../../../util/socket");

var request = require("../../../util/request");

exports.bindSocket = function(socket, provider, io)
{
    socketUtil.bindGitana(socket, function() {

        socket.on("acquireEditorialSession", function(sessionKey, repositoryId, branchId, force, callback) {
            acquireEditorialSession(socket, provider, sessionKey, repositoryId, branchId, force, callback);
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

        /**
         * Acquires an editorial session.  If a session doesn't already exists, it is created.
         * If a session already exists, it is reused unless `force` is set true.
         *
         * @param socket
         * @param provider
         * @param sessionKey
         * @param repositoryId
         * @param branchId
         * @param force
         * @param callback
         */
        var acquireEditorialSession = function(socket, provider, sessionKey, repositoryId, branchId, force, callback)
        {
            // send an HTTP command to acquire an editorial session for this repository and branch
            var URL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT, process.env.GITANA_PROXY_PATH) + "/oneteam/editorial/session/acquire";

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

            var qs = {};
            if (force) {
                qs["force"] = true;
            }

            request({
                "method": "POST",
                "url": URL,
                "qs": {},
                "json": json,
                "headers": headers,
                "timeout": process.defaultHttpTimeoutMs
            }, function(err, response, json) {

                if (err || (json && json.error)) {
                    return callback(err);
                }

                callback(null, json._doc, json.branchId);
            });
        };
    });

    /**
     * Releases an editorial session, deleting the session branch and erasing any accumulated work.
     *
     * @param socket
     * @param provider
     * @param sessionKey
     * @param repositoryId
     * @param branchId
     * @param callback
     */
    var releaseEditorialSession = function(socket, provider, sessionKey, repositoryId, branchId, callback)
    {
        // send an HTTP command to release the session
        var URL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT, process.env.GITANA_PROXY_PATH) + "/oneteam/editorial/session/release";

        var json = {};
        json.repositoryId = repositoryId;
        json.branchId = branchId;
        json.key = sessionKey;

        var headers = {};
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

    /**
     * Sends an HTTP request back to the API to commit the contents of an editorial session branch back to its
     * parent branch.
     *
     * @param socket
     * @param provider
     * @param sessionKey
     * @param repositoryId
     * @param branchId
     * @param callback
     */
    var commitEditorialSession = function(socket, provider, sessionKey, repositoryId, branchId, callback)
    {
        var URL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT, process.env.GITANA_PROXY_PATH) + "/oneteam/editorial/session/commit";

        var json = {};
        json.repositoryId = repositoryId;
        json.branchId = branchId;
        json.key = sessionKey;

        var headers = {};
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

    /**
     * Sends an HTTP request back to the API to request information about an existing editorial session.
     *
     * @param socket
     * @param provider
     * @param sessionKey
     * @param repositoryId
     * @param branchId
     * @param callback
     */
    var editorialSessionInfo = function(socket, provider, sessionKey, repositoryId, branchId, callback)
    {
        var URL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT, process.env.GITANA_PROXY_PATH) + "/oneteam/editorial/session/info";

        var json = {};
        json.repositoryId = repositoryId;
        json.branchId = branchId;
        json.key = sessionKey;

        var headers = {};
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

            if (!body.exists) {
                return callback(null, false);
            }

            callback(null, true, body.session);
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
