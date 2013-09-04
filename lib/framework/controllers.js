var http = require("http");
var path = require("path");

var Gitana = require("gitana");

var exports = module.exports;

var fns = {};

var trigger = function(eventName)
{
    var list = fns[eventName];
    if (list)
    {
        for (var i = 0; i < list.length; i++)
        {
            list[i]();
        }
    }
};

/**
 * Handles registration of a user.
 *
 * @param req
 * @param res
 */
var handleRegister = function(req, res)
{
    // registration info
    var form = req.body;

    // validation
    var errors = [];

    // check for missing password
    if (!form.password)
    {
        errors.push({
            "field": "password",
            "error": "Field 'password' is missing"
        });
    }

    // check for missing verify
    if (!form.passwordVerify)
    {
        errors.push({
            "field": "passwordVerify",
            "error": "Field 'passwordVerify' is missing"
        });
    }

    // check that passwords match
    if (form.password != form.passwordVerify)
    {
        errors.push({
            "field": "password",
            "error": "The passwords do not match."
        });
    }

    // check email provided
    if (!form.email)
    {
        errors.push({
            "field": "email",
            "error": "Field 'email' is missing"
        });
    }

    // check for email validity
    if (form.email)
    {
        var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        if (!re.test(form.email))
        {
            errors.push({
                "field": "email",
                "error": "The provided email is not valid"
            });
        }
    }

    // check username
    if (!form.username)
    {
        errors.push({
            "field": "username",
            "error": "Field 'username' is missing"
        });
    }

    // gitana instance
    var gitana = req.gitana;

    // check if a user already exists with this username
    Chain(gitana.datastore("principals")).trap(function() {

        // not found
        p();

    }).readPrincipal(form.username).then(function() {

        // found
        errors.push({
            "field": "username",
            "error": "A user already exists for this username."
        });

        p();

    });

    var p = function()
    {
        if (errors && errors.length > 0)
        {
            res.send({
                "ok": false,
                "errors": errors
            });
            return;
        }

        var errHandler = function(err) {

            callback({
                "message": err.message
            });
        };

        Chain(gitana.datastore("principals")).trap(errHandler).createUser({
            "name": form.username,
            "email": form.email,
            "password": form.password
        }).then(function() {

            // add the user to the "appusers" team for the stack
            var teamKey = "appusers-" + gitana.application().getId();
            Chain(gitana.stack()).readTeam(teamKey).addMember(this).then(function() {

                res.send({
                    "ok": true,
                    "user": this
                });

            });
        });
    };
};

var handleInvalidate = function(req, res)
{
    // custom invalidations
    trigger("invalidate");

    // new timestamp
    process.env.CLOUDCMS_APPSERVER_TIMESTAMP = new Date().getTime();

    // update all socket clients
    process.IO.sockets.emit("timestamp", {
        "timestamp": process.env.CLOUDCMS_APPSERVER_TIMESTAMP
    });

    console.log("Server timestamp regenerated");

    res.send({
        "ok": true,
        "timestamp": process.env.CLOUDCMS_APPSERVER_TIMESTAMP
    });
};

var handleInfo = function(req, res)
{
    res.send({
        "ok": true,
        "timestamp": process.env.CLOUDCMS_APPSERVER_TIMESTAMP,
        "process.env.CLOUDCMS_APPSERVER_MODE": process.env.CLOUDCMS_APPSERVER_MODE
    });
};

exports.init = function(app)
{
    /**
     * Registers a user.
     */
    app.post("/register", function(req, res) {
        handleRegister(req, res);
    });

    /**
     * Invalidates all HTML5 and server-side caches.
     */
    app.get("/server/invalidate", function(req, res) {
        handleInvalidate(req, res);
    });

    /**
     * Debug helper
     */
    app.get("/server/info", function(req, res) {
        handleInfo(req, res);
    });

    /**
     * Form Submit handler
     */
    app.post("/form/:listKey", function(req, res) {

        var listKey = req.params.listKey;

        handleFormPost(req, res, listKey);
    });
};

exports.onInvalidate = function(fn)
{
    if (!fns["invalidate"])
    {
        fns["invalidate"] = [];
    }

    fns["invalidate"].push(fn);
};

/**
 * Handles a form post.
 *
 * @param req
 * @param res
 */
var handleFormPost = function(req, res, listKey)
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


    var successUrl = req.param("successUrl");
    var failureUrl = req.param("failureUrl");

    // use the app user
    var gitana = req.gitana;

    var errHandler = function(err) {

        console.log("ERROR: " + err);

        if (failureUrl)
        {
            res.redirect(failureUrl);
        }
        else
        {
            res.send({
                "ok": false,
                "error": + JSON.stringify(err)
            });
        }
    };

    // find the repository and branch
    Chain(gitana.datastore("content")).trap(errHandler).readBranch("master").then(function() {

        var url = "/pub/repositories/" + this.getRepositoryId() + "/branches/" + this.getId() + "/lists/" + listKey;

        // post form to Cloud CMS using public method
        var request = require("request");
        var URL = process.env.GITANA_PROXY_SCHEME + "://" + process.env.GITANA_PROXY_HOST + ":" + process.env.GITANA_PROXY_PORT + url;
        request({
            "method": "POST",
            "url": URL,
            "qs": {},
            "json": form
        }, function(err, response, body) {

            //console.log("Response error: " + err);
            //console.log("Response: " + response);
            //console.log("Body: " + body);

            if (err)
            {
                if (failureUrl)
                {
                    res.redirect(failureUrl);
                }
                else
                {
                    res.send(500, {
                        "ok": false
                    });
                }
            }

            if (successUrl)
            {
                res.redirect(successUrl);
            }
            else
            {
                res.send({
                    "ok": true
                });
            }
        });
    });
};