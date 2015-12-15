module.exports = function(options)
{
    // allow for override
    if (process.env.CLOUDCMS_LAUNCHPAD_SETUP) {
        options.setup = process.env.CLOUDCMS_LAUNCHPAD_SETUP;
    }

    // default to single mode
    if (!options.setup) {
        options.setup = "single";
    }

    process.env.CLOUDCMS_LAUNCHPAD_SETUP = options.setup;

    var launch = require("./launchers/" + options.setup);
    launch(options);
};