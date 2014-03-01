var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var request = require("request");

var mime = require("mime");

var VALID_IP_ADDRESS_REGEX_STRING = "^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$";

exports = module.exports;

var rmdirRecursiveSync = function(directoryPath)
{
    if (!directoryPath || directoryPath.length < 4 || directoryPath == "/") {
        throw new Error("Cannot delete null or root directory");
        return;
    }

    if (!fs.existsSync(directoryPath))
    {
        return;
    }

    var list = fs.readdirSync(directoryPath);
    for (var i = 0; i < list.length; i++)
    {
        if (list[i] == "." || list[i] == "..")
        {
            // pass these files
            continue;
        }

        var filepath = path.join(directoryPath, list[i]);

        var isDirectory = false;
        var isFile = false;
        var isLink = false;
        try
        {
            var stat = fs.lstatSync(filepath);

            isDirectory = stat.isDirectory();
            isFile = stat.isFile();
            isLink = stat.isSymbolicLink();

        } catch (e) {}
        if (isLink || isFile)
        {
            fs.unlinkSync(filepath);
        }
        else if (isDirectory)
        {
            rmdirRecursiveSync(filepath);
        }
        else
        {
            // unable to process
            console.log("Unable to determine stat");
        }
    }

    fs.rmdirSync(directoryPath);
};

var executeCommands = function(commands, callback)
{
    var terminal = require('child_process').spawn('bash');

    var text = "";

    terminal.stdout.on('data', function (data) {
//        console.log('stdout: ' + data);
        text = text + data;
    });

    terminal.on('exit', function (code) {

        var err = null;
        if (code != 0)
        {
//            console.log('child process exited with code ' + code + ' for commands: ' + commands);

            err = {
                "commands": commands,
                "message": text,
                "code": code
            };
        }

        callback(err);
    });

    setTimeout(function() {
//        console.log('Sending stdin to terminal');

        for (var i = 0; i < commands.length; i++)
        {
            var command = commands[i];
            terminal.stdin.write(command + "\n");
        }

        terminal.stdin.end();

    }, 1000);
};

var gitInit = function(directoryPath, callback)
{
    var commands = [];
    commands.push("cd " + directoryPath);
    commands.push("git init");
    executeCommands(commands, function(err) {
        callback(err);
    });
};

var gitPull = function(directoryPath, gitUrl, callback)
{
    if (gitUrl.indexOf("https://") === 0)
    {
        var username = process.env.CLOUDCMS_NET_GITHUB_USERNAME;
        var password = process.env.CLOUDCMS_NET_GITHUB_PASSWORD;

        password = escape(password).replace("@", "%40");

        var token = username + ":" + password;

        gitUrl = gitUrl.substring(0, 8) + token + "@" + gitUrl.substring(8);
    }

    var commands = [];
    commands.push("cd " + directoryPath);
    commands.push("git pull " + gitUrl);
    executeCommands(commands, function(err) {
        callback(err);
    });
};

/**
 * This does a git init followed by a pull.
 *
 * It's intended to be run in a fresh directory only.
 *
 * @type {*}
 */
exports.gitCheckout = function(hostDirectoryPath, gitUrl, callback)
{
    // create a temp directory
    var tempDirectoryPath = path.join(hostDirectoryPath, "temp-" + new Date().getTime());
    mkdirs(tempDirectoryPath, function(err) {

        if (err) {
            callback(err, host);
            return;
        }

        // check out into the temp directory
        gitInit(tempDirectoryPath, function(err) {

            if (err) {
                callback(err);
                return;
            }

            gitPull(tempDirectoryPath, gitUrl, function(err) {

                if (err) {
                    callback(err);
                    return;
                }

                // make sure there is a "public" directory
                var publicDirectoryPath = path.join(hostDirectoryPath, "public");
                mkdirs(publicDirectoryPath, function(err) {

                    if (err) {
                        callback(err);
                        return;
                    }

                    // make sure there is a "public_build" directory
                    var publicBuildDirectoryPath = path.join(hostDirectoryPath, "public_build");
                    mkdirs(publicBuildDirectoryPath, function(err) {

                        if (err) {
                            callback(err);
                            return;
                        }

                        var copied = false;

                        // if the temp folder has a "public" directory, copy all of its children into "public"
                        var tempPublicDirectory = path.join(tempDirectoryPath, "public");
                        if (fs.existsSync(tempPublicDirectory))
                        {
                            copyChildrenToDirectory(tempPublicDirectory, publicDirectoryPath);
                            copied = true;
                        }

                        // if the temp folder has a "public_build" directory, copy all of its children into "public_build"
                        var tempPublicBuildDirectory = path.join(tempDirectoryPath, "public_build");
                        if (fs.existsSync(tempPublicBuildDirectory))
                        {
                            copyChildrenToDirectory(tempPublicBuildDirectory, publicBuildDirectoryPath);
                            copied = true;
                        }

                        // if neither "public" nor "public_build" copied, then copy root
                        if (!copied)
                        {
                            copyChildrenToDirectory(tempDirectoryPath, publicDirectoryPath);
                        }


                        // CONFIG
                        var configDirectoryPath = path.join(hostDirectoryPath, "config");
                        mkdirs(configDirectoryPath, function(err) {

                            if (err) {
                                callback(err);
                                return;
                            }

                            var tempConfigDirectory = path.join(tempDirectoryPath, "config");
                            if (fs.existsSync(tempConfigDirectory))
                            {
                                copyChildrenToDirectory(tempConfigDirectory, configDirectoryPath);
                            }


                            // copy GITANA.JSON
                            var tempGitanaJsonFilePath = path.join(tempDirectoryPath, "gitana.json");
                            if (fs.existsSync(tempGitanaJsonFilePath))
                            {
                                copyFile(tempGitanaJsonFilePath, path.join(hostDirectoryPath, "gitana.json"));
                            }

                            // now remove temp directory
                            rmdir(tempDirectoryPath);

                            callback(err);

                        });
                    });
                });

            });
        });

    });
};

var rmdir = exports.rmdir = function(directory)
{
    rmdirRecursiveSync(directory);
};

var mkdirs = exports.mkdirs = function(directoryPath, callback)
{
    mkdirp(directoryPath, function(err) {
        callback(err);
    });
};

var copyFile = exports.copyFile = function(srcFile, destFile)
{
    var contents = fs.readFileSync(srcFile);
    fs.writeFileSync(destFile, contents);
};

var copyChildrenToDirectory = function(sourceDirectoryPath, targetDirectoryPath)
{
    var filenames = fs.readdirSync(sourceDirectoryPath);
    for (var i = 0; i < filenames.length; i++)
    {
        var filenamePath = path.join(sourceDirectoryPath, filenames[i]);
        var stat = fs.lstatSync(filenamePath);

        var isDirectory = stat.isDirectory();
        var isFile = stat.isFile();
        //var isLink = stat.isSymbolicLink();

        if (isFile)
        {
            // make sure this isn't a file we should skip
            var skip = false;
            if (filenames[i] === "gitana.json")
            {
                skip = true;
            }

            if (!skip)
            {
                copyFile(filenamePath, path.join(targetDirectoryPath, filenames[i]));
            }
        }
        else if (isDirectory)
        {
            require("wrench").copyDirSyncRecursive(filenamePath, path.join(targetDirectoryPath, filenames[i]));
        }
    }
};

/**
 * Determines the public path.
 *
 * If the request is for a virtual host, the path is resolved to the virtual host files path.
 *
 * @param req
 * @returns {*}
 */
exports.publicPath = function(req)
{
    var publicPath = process.env.CLOUDCMS_APPSERVER_PUBLIC_PATH;
    if (req.virtualHost && req.virtualHostDirectoryPath)
    {
        publicPath = path.join(req.virtualHostDirectoryPath, "public");
        if (process.env.CLOUDCMS_APPSERVER_MODE == "production")
        {
            var publicBuildPath = path.join(req.virtualHostDirectoryPath, "public_build");
            if (fs.existsSync(publicBuildPath))
            {
                var filenames = fs.readdirSync(publicBuildPath);
                if (filenames && filenames.length > 0)
                {
                    publicPath = publicBuildPath;
                }
            }
        }
    }

    return publicPath;
};

exports.trim = function(text)
{
    return text.replace(/^\s+|\s+$/g,'');
};

var sendFile = exports.sendFile = function(res, filepath, options, callback)
{
    if (typeof(options) == "function") {
        errHandler = options;
        options = {};
    }

    if (!options) {
        options = {};
    }

    var mimetype = null;

    var filename = path.basename(filepath);
    if (filename)
    {
        var ext = path.extname(filename);
        if (ext)
        {
            mimetype = mime.lookup(ext);
        }
    }

    if (mimetype)
    {
        res.setHeader("Content-Type", mimetype);
    }

    res.sendfile(filepath, options, function(err) {
        callback(err);
    });
};

var showHeaders = exports.showHeaders = function(req)
{
    for (var k in req.headers)
    {
        console.log("HEADER: " + k + " = " + req.headers[k]);
    }
};

/**
 * Helper function designed to automatically retry requests to a back end service over HTTP using authentication
 * credentials acquired from an existing Gitana driver.  If a request gets back an invalid_token, the Gitana
 * driver token state is automatically refreshed.
 *
 * @type {Function}
 */
var retryGitanaRequest = exports.retryGitanaRequest = function(requestOrSocket, gitana, config, maxAttempts, callback)
{
    var _retryHandler = function(gitana, config, currentAttempts, maxAttempts, previousError, cb)
    {
        requestOrSocket._log("Heard invalid_token, attempting retry (" + currentAttempts + " / " + maxAttempts + ")");

        // tell gitana driver to refresh access token
        gitana.getDriver().refreshAuthentication(function(err) {

            if (err)
            {
                requestOrSocket._log("Failed to refresh access_token: " + JSON.stringify(err));
            }

            // try again with attempt count + 1
            _handler(gitana, config, currentAttempts + 1, maxAttempts, previousError, cb)
        });
    };

    var _handler = function(gitana, config, currentAttempts, maxAttempts, previousError, cb)
    {
        if (currentAttempts === maxAttempts)
        {
            cb({
                "message": "Maximum number of connection attempts exceeded(" + maxAttempts + ")",
                "err": previousError
            });

            return;
        }

        // make sure we have a headers object
        if (!config.headers)
        {
            config.headers = {};
        }

        // add "authorization" header for OAuth2 bearer token
        var headers2 = gitana.getDriver().getHttpHeaders();
        config.headers["Authorization"] = headers2["Authorization"];

        // make the request
        request(config, function(err, response, body) {

            // ok case (just callback)
            if (response && response.statusCode == 200)
            {
                cb(err, response, body);
                return;
            }

            // look for the special "invalid_token" case
            var isInvalidToken = false;
            if (body)
            {
                try
                {
                    var json = JSON.parse(body);
                    if (json && json.error == "invalid_token")
                    {
                        isInvalidToken = true;
                    }
                }
                catch (e)
                {
                }
            }
            if (isInvalidToken)
            {
                // we go through the retry handler
                _retryHandler(gitana, config, currentAttempts, maxAttempts, {
                    "message": "Unable to load asset from remote store",
                    "code": response.statusCode,
                    "body": body,
                    "err": err
                }, cb);

                return;
            }

            // otherwise, we just hand back some kind of error
            cb(err, response, body);
        });
    };

    _handler(gitana, config, 0, 2, null, callback);
};

var isIPAddress = exports.isIPAddress = function(text)
{
    var rx = new RegExp(VALID_IP_ADDRESS_REGEX_STRING);
    return rx.test(text);
};
