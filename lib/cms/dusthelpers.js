var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("util");

var mkdirp = require('mkdirp');

var Gitana = require('gitana');

exports = module.exports = function(dust)
{
    /*
    dust.helpers.partial = function(chunk, context, bodies, params)
    {
        var partial_context = {};
        // optional : context fo server processed partial related data
        var p_context = context.get("partial");

        if (p_context || params)
        {
            // add to the partial context
        }

        return bodies.block( chunk, dust.makeBase(partial_context));
    };
    */

    /**
     * QUERY
     *
     * Queries for content from the content repository and renders.
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.query = function(chunk, context, bodies, params)
    {
        var type = dust.helpers.tap(params.type, chunk, context);

        var sort = dust.helpers.tap(params.sort, chunk, context);
        var limit = dust.helpers.tap(params.limit, chunk, context);
        var skip = dust.helpers.tap(params.skip, chunk, context);

        // ensure limit and skip are numerical
        if (typeof(limit) !== "undefined")
        {
            limit = parseInt(limit);
        }
        if (typeof(skip) !== "undefined")
        {
            skip = parseInt(skip);
        }

        return chunk.map(function(chunk) {
            setTimeout(function() {

                var gitana = process.gitana.appuser;

                var errHandler = function(err) {

                    console.log("ERROR: " + err);
                };

                Chain(gitana.datastore("content")).trap(errHandler).readBranch("master").then(function() {

                    var query = {};
                    if (type)
                    {
                        query._type = type;
                    }

                    var pagination = {};
                    if (sort)
                    {
                        pagination.sort = {};
                        pagination.sort[sort] = 1;
                    }
                    if (limit)
                    {
                        pagination.limit = limit;
                    }
                    if (skip)
                    {
                        pagination.skip = skip;
                    }

                    this.queryNodes(query, pagination).then(function() {

                        var source = {
                            "rows": this.asArray(),
                            "offset": this.offset(),
                            "total": this.totalRows()
                        };

                        var newContext = {};
                        newContext.user = context.user;
                        newContext.rows = source.rows;
                        newContext.offset = source.offset;
                        newContext.total = source.total;

                        chunk.render(bodies.block, dust.makeBase(newContext));
                        chunk.end("");
                    });
                });

            });
        });
    };

    /**
     * SEARCH
     *
     * Searches for content and renders.
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.search = function(chunk, context, bodies, params)
    {
        var sort = dust.helpers.tap(params.sort, chunk, context);
        var limit = dust.helpers.tap(params.limit, chunk, context);
        var skip = dust.helpers.tap(params.skip, chunk, context);

        var text = dust.helpers.tap(params.text, chunk, context);

        // ensure limit and skip are numerical
        if (typeof(limit) !== "undefined")
        {
            limit = parseInt(limit);
        }
        if (typeof(skip) !== "undefined")
        {
            skip = parseInt(skip);
        }

        return chunk.map(function(chunk) {
            setTimeout(function() {

                var gitana = process.gitana.appuser;

                var errHandler = function(err) {

                    console.log("ERROR: " + err);
                };

                Chain(gitana.datastore("content")).trap(errHandler).readBranch("master").then(function() {

                    var pagination = {};
                    if (sort)
                    {
                        pagination.sort = {};
                        pagination.sort[sort] = 1;
                    }
                    if (limit)
                    {
                        pagination.limit = limit;
                    }
                    if (skip)
                    {
                        pagination.skip = skip;
                    }

                    this.searchNodes(text, pagination).then(function() {

                        var source = {
                            "rows": this.asArray(),
                            "offset": this.offset(),
                            "total": this.totalRows()
                        };

                        var newContext = {};
                        newContext.user = context.user;
                        newContext.rows = source.rows;
                        newContext.offset = source.offset;
                        newContext.total = source.total;

                        chunk.render(bodies.block, dust.makeBase(newContext));
                        chunk.end("");
                    });
                });

            });
        });
    };

    /**
     * CONTENT
     *
     * Selects a single content item.
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.content = function(chunk, context, bodies, params)
    {
        var id = dust.helpers.tap(params.id, chunk, context);
        var contentPath = dust.helpers.tap(params.path, chunk, context);

        return chunk.map(function(chunk) {
            setTimeout(function() {

                var gitana = process.gitana.appuser;

                var errHandler = function(err) {

                    console.log("ERROR: " + err);
                };

                var f = function(node)
                {
                    var newContext = {};
                    newContext.user = context.user;
                    newContext.content = JSON.parse(JSON.stringify(node));

                    // add in attachments info
                    var attachments = {};
                    node.listAttachments().each(function() {
                        var id = this["_doc"];
                        attachments[id] = JSON.parse(JSON.stringify(this));
                        attachments[id]["url"] = "/static/node/" + node.getId() + "/attachments/" + id;
                        attachments[id]["preview32"] = "/static/node/" + node.getId() + "/preview/?attachment=" + id + "&size=32";
                        attachments[id]["preview64"] = "/static/node/" + node.getId() + "/preview/?attachment=" + id + "&size=64";
                        attachments[id]["preview128"] = "/static/node/" + node.getId() + "/preview/?attachment=" + id + "&size=128";
                        attachments[id]["preview256/"] = "/static/node/" + node.getId() + "/preview/?attachment=" + id + "&size=256";
                    }).then(function() {

                        newContext.content.attachments = attachments;

                        chunk.render(bodies.block, dust.makeBase(newContext));
                        chunk.end("");

                    });
                };

                Chain(gitana.datastore("content")).trap(errHandler).readBranch("master").then(function() {

                    // select by ID or select by Path
                    if (id)
                    {
                        this.readNode(id).then(function() {
                            f(this);
                        });
                    }
                    else if (contentPath)
                    {
                        this.readNode("root", contentPath).then(function() {
                            f(this);
                        });
                    }
                    else
                    {
                        // missing both ID and Path?
                        console.log("Missing ID and PATH!");
                    }
                });

            });
        });
    };

    /**
     * FORM
     *
     * Renders a form.
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.form = function(chunk, context, bodies, params)
    {
        var definition = dust.helpers.tap(params.definition, chunk, context);
        var form = dust.helpers.tap(params.form, chunk, context);
        var list = dust.helpers.tap(params.list, chunk, context);

        return chunk.map(function(chunk) {
            setTimeout(function() {

                var gitana = process.gitana.appuser;

                var errHandler = function(err) {

                    console.log("ERROR: " + err);
                };

                Chain(gitana.datastore("content")).trap(errHandler).readBranch("master").then(function() {

                    // read the definition
                    this.readDefinition(definition).then(function() {
                        var schema = this;

                        // if a form is specified, read the form
                        var options = null;
                        this.readForm(form).then(function() {
                            options = this;
                        });

                        this.then(function() {

                            if (!options)
                            {
                                options = {};
                            }

                            var config = {
                                "schema": schema,
                                "options": options
                            };
                            options.renderForm = true;
                            options.form = {
                                "attributes": {
                                    "method": "POST",
                                        "action": "/form/" + list + "?successUrl=/form.html",
                                        "enctype": "multipart/form-data"
                                },
                                "buttons": {
                                    "submit": {
                                        "value": "Submit the Form"
                                    }
                                }
                            };

                            var divId = "form" + new Date().getTime();

                            chunk.write("<div id='" + divId + "'></div>");
                            chunk.write("<script>\r\n$('#" + divId + "').alpaca(" + JSON.stringify(config) + ");</script>\r\n");
                            chunk.end("");
                        });
                    });
                });

            });
        });
    };

};

