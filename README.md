cloudcms-server
===============

A Node.js module that provides a framework and server-side functionality for Cloud CMS deployed Node.js applications.  This module provides the backbone capabilities for the application server tier of Cloud CMS as hosted at cloudcms.net.

For more information on Cloud CMS, please visit https://www.cloudcms.com.

## Configuration

The start method takes a configuration object that enables, disables and provides settings for any underlying services.

This looks like:

````
{
    "name": "Cloud CMS Application Server",
    "socketFunctions": [],
    "routeFunctions": [],
    "configureFunctions": {},
    "beforeFunctions": [],
    "afterFunctions": [],
    "viewEngine": "handlebars",
    "storeEngines": {
        "app": {
            "type": "fs",
            "config": {
                "basePath": "{appBasePath}"
            }
        },
        "hosts_fs": {
            "type": "fs",
            "config": {
                "basePath": "/hosts/{host}"
            }
        },
        "hosts_s3": {
            "type": "s3",
            "config": {
                "accessKey": "",
                "secretKey": "",
                "bucket": "",
                "basePath": "/hosts/{host}"
            }
        },
        "hosts_s3fs": {
            "type": "s3fs",
            "config": {
                "accessKey": "",
                "secretKey": "",
                "bucket": "",
                "basePath": "/hosts/{host}"
            }
        }
    },
    "storeConfigurations": {
        "default": {
            "root": "app",
            "config": "app",
            "web": "app",
            "content": "app"
        },
        "oneteam": {
            "root": "hosts_fs",
            "config": "app",
            "web": "app",
            "content": "hosts_fs"
        },
        "net-development": {
            "root": "hosts_fs",
            "config": "hosts_fs",
            "web": "hosts_fs",
            "content": "hosts_fs"
        },
        "net-production": {
            "root": "hosts_s3fs",
            "config": "hosts_s3fs",
            "web": "hosts_s3fs",
            "content": "hosts_s3fs"
        },
        "net-development-s3": {
            "root": "hosts_s3",
            "config": "hosts_s3",
            "web": "hosts_s3",
            "content": "hosts_s3"
        },
        "net-development-s3fs": {
            "root": "hosts_s3fs",
            "config": "hosts_s3fs",
            "web": "hosts_s3fs",
            "content": "hosts_s3fs"
        }
    },
    "virtualHost": {
        "enabled": false // true
    },
    "wcm": {
        "enabled": false // true
    },
    "serverTags": {
        "enabled": false // true
    },
    "insight": {
        "enabled": false // true
    },
    "perf": {
        "enabled": true // true
    },
    "driverConfig": {
        "enabled": true
    },
    "virtualDriver": {
        "enabled": false
    },
    "flow": {
        "enabled": false
    },
    "auth": {
        "enabled": true,
        "providers": {
            "facebook": {
                "enabled": false
            },
            "twitter": {
                "enabled": false
            },
            "linkedin": {
                "enabled": false
            }
        }
    },
    "notifications": {
        "enabled": false,
        "type": "sqs",
        "configuration": {
            "queue": "",
            "accessKey": "",
            "secretKey": "",
            "region": ""
        }
    },
    "broadcast": {
        "enabled": true
    },
    "local": {
        "enabled": true
    },
    "welcome": {
        "enabled": true,
        "file": "index.html"
    },
    "config": {
        "enabled": true
    },
    "cache": {
        "enabled": true
    }
}
````