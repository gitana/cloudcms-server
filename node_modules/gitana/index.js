var Gitana = require("./lib/gitana");
var fs = require("fs");

// default settings so that we connect to Cloud CMS demo sandbox (by default)
Gitana.DEFAULT_CONFIG = {
	"clientKey": "676e3450-6131-46c2-99cc-496aa2ad80fa",
	"clientSecret": "5fGkvesH/tWEMX6SpevL54rY6iJK5ADzLH963sif2ljrWvFOhV2zXv6rSpLF2uMWlJ9SG0uEO9uQO4JZac0i7DZquA/5W8ixJwhj76g0Ksk=",
	"baseURL": "https://api.cloudcms.com",
	"username": "demo",
	"password": "demo"
};

// tell Gitana driver to load settings from an optional "gitana.json" file
Gitana.loadDefaultConfig = function() {

	var defaultConfig = null;
	if (fs.existsSync(__dirname + "/../../gitana.json")) {
		defaultConfig = JSON.parse(fs.readFileSync(__dirname + "/../../gitana.json"));
	}
		
	return defaultConfig;
};

module.exports = Gitana;