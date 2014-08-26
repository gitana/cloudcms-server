module.exports = function(grunt) {

    var fs = require("fs");
    var path = require("path");

    grunt.loadNpmTasks('grunt-contrib');

    grunt.registerTask('default', ['update']);

    grunt.registerTask("update", "Updates the JS driver", function() {

		// js driver
        var jsPackage = grunt.file.readJSON('../gitana-javascript-driver/package.json');
        var jsVersion = jsPackage.version;

		// package
        var pkg = grunt.file.readJSON('package.json');
		pkg.version = jsVersion;
        fs.writeFileSync("package.json", JSON.stringify(pkg, null, "    "));

		// copy in the latest driver
		if (fs.existsSync('lib/gitana.js'))
		{
			fs.unlinkSync('lib/gitana.js');			
		}
		grunt.file.copy('../gitana-javascript-driver/dist/gitana.js', 'lib/gitana.js');
		
		if (fs.existsSync('lib/gitana.min.js'))
		{
			fs.unlinkSync('lib/gitana.min.js');			
		}
		grunt.file.copy('../gitana-javascript-driver/dist/gitana.min.js', 'lib/gitana.min.js');
    });

};