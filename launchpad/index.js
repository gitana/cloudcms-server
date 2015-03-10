var launchSingle = require("./launchers/single");
var launchMultiple = require("./launchers/multiple");
var launchCluster = require("./launchers/cluster");

var semver = require("semver");

module.exports = function(options)
{
    // default to single mode
    if (!options.setup) {
        options.setup = "single";
    }

    // safety check: "cluster" requires Node 0.12.0 or greater
    if (options.setup === "cluster")
    {
        if (semver.lt(process.version, "0.12.0"))
        {
            console.log("WARNING::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::");
            console.log(":::");
            console.log("::: LaunchPad 'cluster' mode requires Node version > 0.12.0");
            console.log("::: Current version: " + process.version);
            console.log(":::");
            console.log("WARNING::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::");
            console.log("");
        }
    }

    process.env.CLOUDCMS_LAUNCHPAD_SETUP = options.setup;

    if (options.setup === "single") {
        return launchSingle(options);
    }
    else if (options.setup === "multiple") {
        return launchMultiple(options);
    }
    else if (options.setup === "cluster") {
        return launchCluster(options);
    }
};