var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');

var util = require('./util');

exports = module.exports = function(basePath)
{
    var r = {};

    /**
     * Returns the base directory path where resources for the given host should be stored.
     *
     * @param host
     * @return {*}
     */
    r.hostDirectoryPath = function(host)
    {
        return path.join(basePath, host);
    };

    r.isDeployed = function(host)
    {
        var hostDirectoryPath = this.hostDirectoryPath(host);

        var count = 0;

        if (fs.existsSync(hostDirectoryPath))
        {
            var list = fs.readdirSync(hostDirectoryPath);
            for (var i = 0; i < list.length; i++)
            {
                if (list[i] == "." || list[i] == "..")
                {
                    // pass these files
                    continue;
                }

                count++;
            }
        }

        return (count > 0);
    };

    r.existsHostDirectory = function(host, callback)
    {
        var hostDirectoryPath = this.hostDirectoryPath(host);

        fs.exists(hostDirectoryPath, function(exists)
        {
            callback(exists);
        });
    };

    r.ensureHostDirectory = function(host, callback)
    {
        var hostDirectoryPath = this.hostDirectoryPath(host);

        fs.exists(hostDirectoryPath, function(exists) {

            if (!exists)
            {
                mkdirp(hostDirectoryPath, function() {
                    callback(null, hostDirectoryPath);
                });
            }
            else
            {
                callback(null, hostDirectoryPath);
            }
        });
    };

    r.removeHostDirectory = function(host, callback)
    {
        var hostDirectoryPath = this.hostDirectoryPath(host);

        util.rmdir(hostDirectoryPath);

        callback();
    };

    return r;
};


