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

## Environment Variables

The following environment variables can be set to control the server's configuration from the container level:

### Virtual Driver Service
The virtual driver configuration is used to connect to Cloud CMS and request gitana driver credentials based on
the incoming domain name.  These parameters override any settings provided for the <code>virtualDriver</code>
service block:

- CLOUDCMS_VIRTUAL_DRIVER_BASE_URL
- CLOUDCMS_VIRTUAL_DRIVER_CLIENT_KEY
- CLOUDCMS_VIRTUAL_DRIVER_CLIENT_SECRET
- CLOUDCMS_VIRTUAL_DRIVER_AUTHGRANT_KEY
- CLOUDCMS_VIRTUAL_DRIVER_AUTHGRANT_SECRET

### Broadcast Service
The broadcast service provides a communication and notification facility between nodes in the application server cluster.
The cluster is elastic and may grow and shrink in size as demand increases and decreases.  The type can be either
<code>noop</code> (disabled) or <code>redis</code>.

- CLOUDCMS_BROADCAST_TYPE
- CLOUDCMS_BROADCAST_REDIS_PORT
- CLOUDCMS_BROADCAST_REDIS_ENDPOINT

### Cache Service
The cache service provides a cluster-wide cache accessible from any node or process in the cluster.  The type can be
either <code>memory</code> or <code>redis</code>.

- CLOUDCMS_CACHE_TYPE
- CLOUDCMS_CACHE_REDIS_PORT
- CLOUDCMS_CACHE_REDIS_ENDPOINT

### Virtual Host (single-tenant)
If running in a non-virtualized host mode, you must specify the host name being served.  The host name corresponds
to the tenant slug that identifies the Cloud CMS tenant being served.

- CLOUDCMS_VIRTUAL_HOST

Suppose you set CLOUDCMS_VIRTUAL_HOST to "customer1.cloudcms.net".  You can then run your application on localhost:3000
and any incoming requests will be handled for the tenant identified by <customer1>.

This approach constrains your application to a single tenant.  For multi-tenant support, see virtual hosting.

### Virtual Hosting (multi-tenant)
Virtual hosting allows the application server to discover incoming host names and map them to gitana credentials.
You must provide the base domain to virtualize against (i.e. http(s)://<tenantSlug>.<domain>).

- CLOUDCMS_VIRTUAL_HOST_DOMAIN

For example, if you set CLOUDCMS_VIRTUAL_HOST_DOMAIN to "cloudcms.net", then hosts will be resolved and handled for
incoming requests like:

    customer1.cloudcms.net
    customer2.cloudcms.net
    
Cloud CMS will connect to the API using the virtual driver credentials to retrieve the proper gitana.json file.
Assets are cached on disk per virtual host and reused on subsequent requests.

### Stores
For every request, underlying persistence stores are applied that automatically configure to read and write objects
to the correct place, either a file system or S3.  Performance caching and directory paths are figured out ahead of
time so that each virtual host works against the correct storage location.

- CLOUDCMS_STORE_CONFIGURATION
- CLOUDCMS_STORE_S3_ACCESS_KEY
- CLOUDCMS_STORE_S3_SECRET_KEY
- CLOUDCMS_STORE_S3_BUCKET

### GitHub
The module supports dynamic application deployment from GitHub or BitBucket.  Application code is deployed into the
virtual hosting directories and served from there.

- CLOUDCMS_NET_GITHUB_USERNAME
- CLOUDCMS_NET_GITHUB_PASSWORD
- CLOUDCMS_NET_BITBUCKET_USERNAME
- CLOUDCMS_NET_BITBUCKET_PASSWORD

### Proxy
These settings configured where the /proxy endpoint points to be default.

GITANA_PROXY_HOST
GITANA_PROXY_PORT
GITANA_PROXY_SCHEME




The following environments are computed automatically and available to services:

- CLOUDCMS_APPSERVER_MODE: either 'development' or 'production', if not specified, derives from NODE_ENV
- CLOUDCMS_APPSERVER_BASE_PATH: the startup location of the node process, applicable when running locally
- CLOUDCMS_APPSERVER_PACKAGE_NAME: the name of the module currently beingrun (from package.json)
- CLOUDCMS_APPSERVER_PACKAGE_VERSION: the version of the module currently being run (from package.json)
- CLOUDCMS_APPSERVER_TIMESTAMP: the timestamp of server startup




# node switches
node --max_old_space_size=3000 --prof nodemem.js
	# --trace_incremental_marking=true --incremental_marking_steps=false
	node --max_old_space_size=3000 --max_new_space_size=3000 --max_executable_size=1000 --gc_global --prof nodemem.js
	# --noincremental_marking
	# --nolazy_sweeping
	# --never_compact
	# --gc_global
	# --gc_interval=100000000
