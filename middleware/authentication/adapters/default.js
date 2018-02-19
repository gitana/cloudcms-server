var AbstractAdapter = require("./abstract");

class DefaultAdapter extends AbstractAdapter
{
    constructor(req, config)
    {
        super(req, config);
    }

    identify(req, callback)
    {
        return super.identify(req, callback);
    }
}

module.exports = DefaultAdapter;
