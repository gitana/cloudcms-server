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
        var path = dust.helpers.tap(params.path, chunk, context);

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
                        attachments[id]["thumb32"] = "/preview/" + node.getId() + "/" + id + "?size=32";
                        attachments[id]["thumb64"] = "/preview/" + node.getId() + "/" + id + "?size=64";
                        attachments[id]["thumb128"] = "/preview/" + node.getId() + "/" + id + "?size=128";
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
                    else if (path)
                    {
                        this.readNode("root", path).then(function() {
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
};

