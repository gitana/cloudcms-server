var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("../../util/util");
var Gitana = require("gitana");
var duster = require("../../duster/index");

/**
 * Registration middleware.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var handleRegistration = function(req, res, next)
    {
        var successUri = req.query.successUri  || req.query.successUrl || req.query.success || "/";
        var failureUri = req.query.failureUri || req.query.failureUrl || req.query.failure || "/";
        var redirect = true;
        if(req.query.redirect && req.query.redirect === "false")
        {
            redirect = false;
        }

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
                req.flash("formErrors", errors);

                if(redirect)
                {
                    res.redirect(failureUri);
                }
                else
                {
                    res.status(200).type("application/json").send(JSON.stringify({"ok": false, "err": errors}));
                }
                return;
            }

            var errHandler = function(err) {

                console.log("ERR: " + JSON.stringify(err));

                if(redirect)
                {
                    res.redirect(failureUri);
                }
                else
                {
                    res.status(200).type("application/json").send(JSON.stringify({"ok": false, "err": err}));
                }
                return;
            };

            var userObject = {};

            var fromProvider = false;
            if (req.session)
            {
                var providerInfo = req.session.lastProviderInfo;
                if (providerInfo)
                {
                    fromProvider = true;

                    var _userObject = providerInfo.userObject;
                    if (_userObject)
                    {
                        for (var k in _userObject) {
                            userObject[k] = _userObject[k];
                        }
                    }
                }
            }

            userObject.name = form.username;
            userObject.email = form.email;
            if (form.firstName)
            {
                userObject.firstName = form.firstName;
            }
            if (form.lastName)
            {
                userObject.lastName = form.lastName;
            }
            if (form.password)
            {
                userObject.password = form.password;
            }

            var completionFn = function(principal)
            {
                if (req.session)
                {
                    delete req.session.lastProviderInfo;
                }

                // add the user to the "appusers" team for the stack
                var teamKey = "appusers-" + gitana.application().getId();
                Chain(gitana.stack()).trap(errHandler).readTeam(teamKey).addMember(principal).then(function() {
                    if(redirect)
                    {
                        res.redirect(successUri);
                    }
                    else
                    {
                        res.status(200).type("application/json").send(JSON.stringify({"ok": true}));
                    }
                });
            };

            var domain = req.gitana.datastore("principals");
            var platform = req.gitana.platform();

            if (fromProvider)
            {
                var providerInfo = req.session.lastProviderInfo;

                var providerId = providerInfo.providerId;
                var providerUserId = providerInfo.providerUserId;
                var token = providerInfo.token;
                var tokenSecret = providerInfo.tokenSecret;
                var profile = providerInfo.profile;

                Chain(platform).readDirectory(domain.defaultDirectoryId).then(function() {

                    //console.log("USER OBJECT: " + JSON.stringify(userObject, null, "  "));

                    this.createUserForProvider(providerId, providerUserId, userObject, token, null, tokenSecret, profile, domain, function(err, data) {

                        if (err)
                        {
                            console.log("Create User for Provider failed: " + JSON.stringify(err));

                            if(redirect)
                            {
                                res.redirect(failureUri);
                            }
                            else
                            {
                                res.status(200).type("application/json").send(JSON.stringify({"ok": false, "err": err}));
                            }
                            return;
                        }

                        // read the user back
                        domain.readPrincipal(data.user._doc).then(function() {

                            var user = this;

                            // sync avatar
                            var lib = require("../authentication/authentication").getProvider(providerId);

                            lib.handleSyncAvatar(req, profile, user, function(err) {
                                completionFn(user);
                            });

                        });

                    });
                });
            }
            else
            {
                Chain(domain).trap(errHandler).createUser(userObject).then(function() {
                    completionFn(this);
                });
            }
        };
    };

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Handles deployment commands.
     *
     * This handler looks for commands to the server and intercepts them.  These are handled through a separate
     * codepath whose primary responsibility is to get the files down to disk so that they can be virtually hosted.
     *
     * @return {Function}
     */
    r.handler = function()
    {
        return function(req, res, next)
        {
            var handled = false;

            if (req.method.toLowerCase() === "post") {

                if (req.url.indexOf("/register") === 0)
                {
                    handleRegistration(req, res, next);
                    handled = true;
                }
            }

            if (!handled)
            {
                next();
            }
        }
    };

    return r;
}();
