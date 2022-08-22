var http = require("http");
var path = require("path");
var fs = require("fs");
var util = require("../util/util");
var request = require("request");

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
            res.send(500, {
                "ok": false,
                "errors": errors
            });
            return;
        }

        var errHandler = function(err) {

            res.send(500, {
                "ok": false,
                "message": err.message
            });
        };

        Chain(gitana.datastore("principals")).trap(errHandler).createUser({
            "name": form.username,
            "email": form.email,
            "password": form.password
        }).then(function() {
            var user = this;

            // add the user to the "appusers" team for the stack
            var teamKey = "appusers-" + gitana.application().getId();
            Chain(gitana.stack()).trap(errHandler).readTeam(teamKey).addMember(user).then(function() {

                res.send({
                    "ok": true,
                    "user": user
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

    // // update all socket clients
    // process.IO.sockets.emit("timestamp", {
    //     "timestamp": process.env.CLOUDCMS_APPSERVER_TIMESTAMP
    // });

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

exports.init = function(app, callback)
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

    callback();
};

exports.onInvalidate = function(fn)
{
    if (!fns["invalidate"])
    {
        fns["invalidate"] = [];
    }

    fns["invalidate"].push(fn);
};
