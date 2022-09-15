cloudcms-server
===============

A Node.js module that provides a framework and server-side functionality for Cloud CMS deployed Node.js applications.  This module provides the backbone capabilities for the application server tier of Cloud CMS as hosted at cloudcms.net.

For more information on Cloud CMS, please visit https://www.cloudcms.com.

## Configuration

The start method takes a configuration object that enables, disables and provides settings for any underlying services.

This looks like:

````
{
    "setup": "single", // single, cluster, redis
    "name": "Cloud CMS Application Server",
    "socketFunctions": [],
    "routeFunctions": [],
    "errorFunctions": [],
    "configureFunctions": {},
    "beforeFunctions": [],
    "afterFunctions": [],
    "reportFunctions": [],
    "dustFunctions": [],
    "initFunctions": [],
    "viewEngine": "handlebars",
    "storeEngines": {
        "app": {
            "type": "fs",
            "config": {
                "basePath": "{appBasePath}"
            }
        },
        "tmp": {
            "type": "fs",
            "config": {
                "basePath": "{tmpdirPath}/hosts/{host}",
                "hostsPath": "{tmpdirPath}/hosts"
            }
        },
        "hosts_fs": {
            "type": "fs",
            "config": {
                "basePath": "{hostsPath}/{host}",
                "hostsPath": "{hostsPath}"
            }
        },
        "hosts_s3": {
            "type": "s3",
            "config": {
                "accessKey": "",
                "secretKey": "",
                "bucket": "",
                "basePath": "{hostsPath}/{host}",
                "hostsPath": "{hostsPath}"
            }
        },
        "hosts_s3fs": {
            "type": "s3fs",
            "config": {
                "accessKey": "",
                "secretKey": "",
                "bucket": "",
                "basePath": "{hostsPath}/{host}",
                "hostsPath": "{hostsPath}"
            }
        }
    },
    "storeConfigurations": {
        "default": {
            "root": "app",
            "config": "app",
            "web": "app",
            "content": "tmp",
            "templates": "app",
            "modules": "app"
        },
        "oneteam": {
            "root": "hosts_fs",
            "config": "app",
            "web": "app",
            "content": "hosts_fs",
            "templates": "app",
            "modules": "hosts_fs"
        },
        "net-development": {
            "root": "hosts_fs",
            "config": "hosts_fs",
            "web": "hosts_fs",
            "content": "hosts_fs",
            "templates": "hosts_fs",
            "modules": "hosts_fs"
        },
        "net-production": {
            "root": "hosts_s3fs",
            "config": "hosts_s3fs",
            "web": "hosts_s3fs",
            "content": "hosts_s3fs",
            "templates": "hosts_s3fs",
            "modules": "hosts_s3fs"
        },
        "net-development-s3": {
            "root": "hosts_s3",
            "config": "hosts_s3",
            "web": "hosts_s3",
            "content": "hosts_s3",
            "templates": "hosts_s3"
        },
        "net-development-s3fs": {
            "root": "hosts_s3fs",
            "config": "hosts_s3fs",
            "web": "hosts_s3fs",
            "content": "hosts_s3fs",
            "templates": "hosts_s3fs",
            "modules": "hosts_s3fs"
        }
    },
    "duster": {
        "fragments": {
            "cache": true
        }
    },
    "virtualHost": {
        "enabled": false
    },
    "wcm": {
        "enabled": false,
        "cache": false
    },
    "serverTags": {
        "enabled": false
    },
    "insight": {
        "enabled": false
    },
    "perf": {
        "enabled": true
    },
    "driverConfig": {
        "enabled": true
    },
    "virtualDriver": {
        "enabled": false
    },
    "virtualContent": {
        "enabled": true
    },
    "flow": {
        "enabled": false
    },
    "form": {
        "enabled": true
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
        "log": true,
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
    },
    "templates": {
        "enabled": true
    },
    "modules": {
        "enabled": true
    },
    "debug": {
        "enabled": false,
        "logGlobalTimings": false
    },
    "cors": {
        "enabled": true,
        "origin": null,
        "methods": "GET, POST, PUT, DELETE, OPTIONS",
        "headers": "X-Forwarded-Host, X-Requested-With, Content-Type, Authorization, Origin, X-Requested-With, X-Prototype-Version, Cache-Control, Pragma, X-CSRF-TOKEN, X-XSRF-TOKEN",
        "credentials": false
    },
    "admin": {
        "enabled": true,
        "username": "admin",
        "password": "admin"
    },
    "bodyParsers": {
        "multipart": {
        },
        "json": {
            "limit": "100kb"
        },
        "urlencoded": {
            "extended": true
        }
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

### Hosting Modes

The server supports three hosting modes: standalone, single virtual tenant, multiple virtual tenants

#### Standalone

By default, the server will start up in standalone hosting mode.  This is intended for a standalone web application
with a local gitana.json file.  The incoming host name is considered to be irrelevant and all on-disk caching is done
against a "local" virtual host.  In essence, no matter what the host name is, the same virtual host is considered.

In this mode, there is no support for virtual driver retrieval.  You must supply the gitana.json locally.

To change the name of the "local" virtual host name, set CLOUDCMS_STANDALONE_HOST environment variable.
The default is "local".

#### Single Virtual Tenant

In single virtual tenant mode, all incoming request, no matter the host, are mapped to a single Cloud CMS tenant's
application deployment.

The virtual driver will retrieve the gitana.json for this tenant and maintain it over time.  If the gitana.json
API keys change on the server, they will be retrieved and used by the app server automatically.

To use this mode, set the following:

    CLOUDCMS_VIRTUAL_HOST
    
This should be set to the host of the Cloud CMS application deployment.

#### Multiple Virtual Tenants

In multiple virtual tenants mode, all incoming requests have their incoming hosts considered.  Each host may describe
a different Cloud CMS application deployment.  For N hosts, there will be N Cloud CMS application instances.  This mode
is intended for cases where you wish to have a single application support N customers.

To use this mode, set the following

    CLOUDCMS_VIRTUAL_HOST_DOMAIN
    
This should be set to a suffix domain that is wildcarded against.  For example, if you set it to "company.com", then
any incoming requests for "<subdomain>.company.com" will be served.  Each request will check with Cloud CMS to make
sure it has the proper gitana.json pulled down for the Cloud CMS application deployment with that host.  Each host
maintains it's own location on disk and is served back via virtual hosting.

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


### Runtime

The module supports dynamic switching of the branch being served from.  It also allows for the runtime cache buster
value to be migrated at any time to allow for cache regeneration.

The following environment variables can be used to set up the initial state:

CLOUDCMS_RUNTIME_CB
CLOUDCMS_RUNTIME_RELEASE_ID
CLOUDCMS_RUNTIME_BRANCH_ID

A runtime.json file is written into each virtual host's content directory.  It can be adjusted at runtime via a
POST call to:

    /_runtime/migrate
    
And the JSON payload should be:

    {
        "branchId": "<newBranchId>",
        "releaseId": "<newReleaseId>",
        "cb": "<newCacheBusterValue>"
    }

Only `branchId` is truly required.  If `cb` is specified, it will be used, otherwise a new ID will be auto-generated.


### Other Environment Variables

The following environments are computed automatically and available to services:

- CLOUDCMS_APPSERVER_MODE: either 'development' or 'production', if not specified, derives from NODE_ENV
- CLOUDCMS_APPSERVER_BASE_PATH: the startup location of the node process, applicable when running locally
- CLOUDCMS_APPSERVER_PACKAGE_NAME: the name of the module currently beingrun (from package.json)
- CLOUDCMS_APPSERVER_PACKAGE_VERSION: the version of the module currently being run (from package.json)
- CLOUDCMS_APPSERVER_TIMESTAMP: the timestamp of server startup


- CLOUDCMS_TEMPDIR_PATH: path to a tmp directory
- CLOUDCMS_HOSTS_PATH: path to the root /hosts directory


# node switches
Examples of Node switches:

    node --max_old_space_size=3000 --prof nodemem.js --trace_incremental_marking=true --incremental_marking_steps=false
    
    node --max_old_space_size=3000 --max_new_space_size=3000 --max_executable_size=1000 --gc_global --prof nodemem.js --noincremental_marking --nolazy_sweeping --never_compact --gc_global --gc_interval=100000000


# admin mode
Administration API functions are available under /_admin.
These can be enabled or disabled via the "admin" config block.

If a "username" and "password" is provided in this config block, it will be asserted via basic configuration ahead of
permitted access to the admin functions.

Admin functions include

    /_admin/cache/invalidate
    
This invalidates the full cache.  Or you can invalidate individual nodes:

    /_admin/cache/invalidate?ref=node://{platformId}/{repositoryId}/{branchId}/{nodeId}
    
Where "ref" is a standard node reference.


