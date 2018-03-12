class AbstractAdapter
{
    constructor(req, config)
    {
        this.config = config || {};
    }

    /**
     * Interrogates the incoming request and extracts essential properties that can be used to identify the user.
     * This method should either hand back:
     *
     *    - undefined - if no identifying information could be found
     *    - a properties object
     *
     * If a properties object is handed back, we know that the request had some identifying information.  At a minimum,
     * the properties handed back should consist of:
     *
     *   {
     *      "token": <identifier>,
     *      "trusted": <boolean>
     *   }
     *
     * Where:
     *
     *    - "token" is the primary identifier (unencrypted or unencoded)
     *    - "trusted" indicates whether the properties being handed back can be trusted
     *
     * If the properties are marked as trusted, this means that that properties being handed back were extracted
     * from the contents of the token in such a way that we know they can be trusted.  The authentication framework can
     * regard these properties as valid.  This is usually only possible if the token is encrypted and sent over HTTPS
     * so that no man-in-the-middle attack is possible.  It applies to certain token types, such as encrypted JWT.
     *
     * @param req
     * @param callback
     */
    identify(req, callback) {

        var value = null;

        if (req.cookies && this.config.cookie)
        {
            value = req.cookies[this.config.cookie];
            if (!value)
            {
                value = req.cookies[this.config.cookie.toLowerCase()];
            }
        }

        if (req.headers && this.config.header)
        {
            value = req.headers[this.config.header];
            if (!value)
            {
                value = req.headers[this.config.header.toLowerCase()];
            }
        }

        if (req.query && this.config.param)
        {
            value = req.query[this.config.param];
            if (!value)
            {
                value = req.query[this.config.param.toLowerCase()];
            }
        }

        if (!value)
        {
            return callback();
        }

        var properties = {};
        properties.token = value;
        properties.trusted = this.config.trusted ? true: false;

        callback(null, properties);
    }
};

module.exports = AbstractAdapter;