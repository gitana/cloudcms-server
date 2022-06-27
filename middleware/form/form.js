var util = require("../../util/util");

var http = require("http");
var https = require("https");

var request = require("../../util/request");

/**
 * Form middleware.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var isEnabled = function()
    {
        if (!process.configuration.form) {
            process.configuration.form = {};
        }

        if (typeof(process.configuration.form.enabled) === "undefined") {
            process.configuration.form.enabled = true;
        }

        return process.configuration.form.enabled;
    };

    var r = {};

    /**
     * Provides handlers for form operations.
     *
     * @return {Function}
     */
    r.formHandler = function()
    {
        return util.createHandler("form", function(req, res, next, stores, cache, configuration) {

            if (!isEnabled())
            {
                return next();
            }

            if (!req.gitana)
            {
                return next();
            }

            if (req.method.toLowerCase() === "get")
            {
                if (req.path.indexOf("/_form/datasource") === 0)
                {
                    return handleGetDataSource(req, res);
                }
            }
            else if (req.method.toLowerCase() === "post")
            {
                if (req.path.indexOf("/_form/submit") === 0)
                {
                    var listKey = req.query["list"];
                    var successUrl = req.query["successUrl"];
                    var failureUrl = req.query["failureUrl"];

                    return handleSubmit(req, res, listKey, successUrl, failureUrl);
                }
            }

            next();

        });
    };

    /**
     * Handles a form post.
     *
     * @param req
     * @param res
     * @param listKey
     * @param successUrl
     * @param failureUrl
     */
    var handleSubmit = function(req, res, listKey, successUrl, failureUrl)
    {
        // submitted form
        var form = req.body;

        // TODO: does this contain payment method information?  should customer account be created?
        if (form.paymentMethod)
        {
            // use the "billing provider" configuration for the project
            // create a customer inside of braintree
            // retain the customer # and store on the domain principal id
        }

        // TODO: should this auto-register a principal?
        if (form.principal)
        {
            // username
            // password
            // email
            // TODO: auto-register
        }

        // find the repository and branch
        req.branch(function(e, branch) {

            var url = null;
            if (listKey)
            {
                url = "/pub/repositories/" + branch.getRepositoryId() + "/branches/" + branch.getId() + "/lists/" + listKey;
            }
            else
            {
                url = "/repositories/" + branch.getRepositoryId() + "/branches/" + branch.getId() + "/nodes";
            }

            if (!url)
            {
                return res.status(503).end();
            }

            // post form to Cloud CMS using public method
            var URL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT, process.env.GITANA_PROXY_PATH) + url;

            var headers = {};
            headers["Authorization"] = req.gitana.platform().getDriver().getHttpHeaders()["Authorization"];

            request({
                "method": "POST",
                "url": URL,
                "qs": {},
                "json": form,
                "headers": headers,
                "timeout": process.defaultHttpTimeoutMs
            }, function(err, response, json) {

                console.log("Response error: " + JSON.stringify(err));
                console.log("Response: " + JSON.stringify(response,null,2));
                console.log("Body: " + JSON.stringify(json,null,2));

                if (err || (json && json.error))
                {
                    if (failureUrl)
                    {
                        return res.redirect(failureUrl);
                    }

                    res.status(500);
                    res.json({
                        "ok": false,
                        "err": err || json.message,
                        "message": json
                    });

                    return;
                }

                if (successUrl)
                {
                    return res.redirect(successUrl);
                }
                else
                {
                    res.status(200);
                    res.json({
                        "ok": true
                    });
                }
            });
        });
    };

    /**
     * Handles retrieval of data source for the "appserver" connector.
     *
     * This simply pipes through to the API's /alpaca/datasource method
     *
     * @param req
     * @param res
     */
    var handleGetDataSource = function(req, res)
    {
        req.branch(function(err, branch) {

            var url = branch.getUri() + "/alpaca/datasource";
    
            var URL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT, process.env.GITANA_PROXY_PATH) + url;

            var headers = {};
            headers["Authorization"] = req.gitana.platform().getDriver().getHttpHeaders()["Authorization"];

            request({
                "method": "POST",
                "url": URL,
                "qs": {},
                "json": form,
                "headers": headers,
                "timeout": process.defaultHttpTimeoutMs
            }, function(err, response, json) {
                response.data.pipe(res);''
            });

        });
    };

    return r;
}();





