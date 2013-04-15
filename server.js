
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');
var fs = require('fs');
var httpProxy = require('http-proxy');

var app = express();

// cloudcms app server support
var cloudcms = require("cloudcms-server");

// let cloudcms pick up beanstalk params
cloudcms.beanstalk();



////////////////////////////////////////////////////////////////////////////
//
// HTTP/HTTPS Proxy Server to Cloud CMS
// Facilitates Cross-Domain communication between Browser and Cloud Server
// This must appear at the top of the app.js file (ahead of config) for things to work
//
////////////////////////////////////////////////////////////////////////////
// START PROXY SERVER
app.use("/proxy", httpProxy.createServer(function(req, res, proxy) {

    proxy.proxyRequest(req, res, {
        "host": process.env.GITANA_PROXY_HOST,
        "port": process.env.GITANA_PROXY_PORT,
        "xforward": true//,
        //"changeOrigin": true
    });
}));
// END PROXY SERVER



////////////////////////////////////////////////////////////////////////////
//
// BASE CONFIGURATION
// Configures NodeJS app server using handlebars templating engine
// Runs on port 2999 by default
//
////////////////////////////////////////////////////////////////////////////
app.configure(function(){

    app.set('port', process.env.PORT || 2999);
    app.set('views', __dirname + '/');
    app.set('view engine', 'html'); // html file extension
    app.engine('html', require('hbs').__express);
    app.use(express.favicon());
    app.use(express.logger('dev'));


    //app.use(express.cookieParser());
    //app.use(express.cookieParser("secret"));

    // use the cloudcms body parser
    app.use(cloudcms.bodyParser());
    //app.use(express.bodyParser()); CANNOT USE THIS

    app.use(express.methodOverride());
    //app.use(express.session({ secret: 'secret', store: sessionStore }));

    // configure cloudcms app server command handing
    cloudcms.interceptors(app, true);

    app.use(app.router);
    app.use(express.errorHandler());

    // configure cloudcms app server handlers
    cloudcms.handlers(app, true);

});

/*
////////////////////////////////////////////////////////////////////////////
//
// DEVELOPMENT CONFIGURATION
//
////////////////////////////////////////////////////////////////////////////
app.configure('development', function() {

    // configure cloudcms app server command handing
    cloudcms.interceptors(app, true);

    app.use(app.router);
    app.use(express.errorHandler());

    // configure cloudcms app server handlers
    cloudcms.handlers(app, true);

    // mount the /public path
    //app.use(express.static(path.join(__dirname, 'public')));
});


////////////////////////////////////////////////////////////////////////////
//
// PRODUCTION CONFIGURATION
//
////////////////////////////////////////////////////////////////////////////
app.configure('production', function() {

    // configure cloudcms app server command handing
    cloudcms.interceptors(app, true);

    app.use(app.router);
    app.use(express.errorHandler());

    // configure cloudcms app server handlers
    cloudcms.handlers(app, true);

    // mount the /public path
    //app.use(express.static(path.join(__dirname, 'public_build')));
});
*/




////////////////////////////////////////////////////////////////////////////
//
// CONTROLLERS
//
////////////////////////////////////////////////////////////////////////////

// define any custom controllers here...
/*
app.get("/api/list", function(req, res) {
    res.render("views/list", {
        "modelVariable": "modelValue"
    });
});
*/



////////////////////////////////////////////////////////////////////////////
//
// SERVER
//
////////////////////////////////////////////////////////////////////////////

// create server
http.createServer(app).listen(app.get('port'), function(){

    var url = "http://localhost:" + app.get('port') + "/";

    console.log("Cloud CMS Application Server Started - visit: " + url);
});
