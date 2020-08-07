var async = require("async");

/**
 * Wraps a single store interface around multiple underlying stores.
 * Offers read-only support (no write).
 *
 * @return {Function}
 */
exports = module.exports = function(originalStores)
{
    var r = {};

    // reverse stores
    var stores = [];
    for (var i = 0; i < originalStores.length; i++)
    {
        stores.push(originalStores[i]);
    }
    stores.reverse();

    var id = "multistore://";
    for (var i = 0; i < stores.length; i++)
    {
        if (i > 0)
        {
            id += "_";
        }

        id += stores[i].id;
    }

    r.id = id;

    //////////////////////////////////////////////////

    r.allocated = function(callback)
    {
        var fns = [];

        for (var i = 0; i < stores.length; i++)
        {
            var fn = function(store) {
                return function(done) {
                    store.allocated(function(allocated) {
                        done(null, allocated);
                    });
                }
            }(stores[i]);

            fns.push(fn);
        }

        async.series(fns, function(err, allocatedArray) {

            var allocated = allocatedArray.some(function(allocated) {
                return allocated;
            });

            callback(allocated);
        });
    };

    r.cleanup = function(callback)
    {
        // TODO: not implemented
        callback();
    };

    r.supportsHosts = function()
    {
        // TODO: not implemented
        return false;
    };

    r.listHosts = function(callback)
    {
        // TODO: not implemented
        callback(null, []);
    };

    //////////////////////////////////////////////////

    r.existsFile = function(filePath, callback)
    {
        var fns = [];

        for (var i = 0; i < stores.length; i++)
        {
            var fn = function(store, filePath) {
                return function(done) {
                    store.existsFile(filePath, function(exists) {
                        done(null, exists);
                    });
                }
            }(stores[i], filePath);

            fns.push(fn);
        }

        async.series(fns, function(err, existsArray) {

            var exists = existsArray.some(function(exists) {
                return exists;
            });

            callback(exists);
        });
    };

    r.existsDirectory = function(directoryPath, callback)
    {
        var fns = [];

        for (var i = 0; i < stores.length; i++)
        {
            var fn = function(store, directoryPath) {
                return function(done) {
                    store.existsFile(directoryPath, function(exists) {
                        done(null, exists);
                    });
                }
            }(stores[i], directoryPath);

            fns.push(fn);
        }

        async.series(fns, function(err, existsArray) {

            var exists = existsArray.some(function(exists) {
                return exists;
            });

            callback(exists);
        });
    };

    r.removeFile = r.deleteFile = function(filePath, options, callback)
    {
        // TODO: not implemented
        callback();
    };

    r.removeDirectory = r.deleteDirectory = function(directoryPath, options, callback)
    {
        // TODO: not implemented
        callback();
    };

    r.listFiles = function(directoryPath, callback)
    {
        var fns = [];

        for (var i = 0; i < stores.length; i++)
        {
            var fn = function(store, i, directoryPath) {
                return function(done) {
                    store.listFiles(directoryPath, function(err, filenames) {
                        //console.log("Store: " + store.id + ", filenames: " + filenames.length + ", err: " + err);
                        done(err, filenames);
                    });
                }
            }(stores[i], i, directoryPath);

            fns.push(fn);
        }

        async.series(fns, function(err, filenamesArray) {

            if (err)
            {
                callback(err);
                return;
            }

            var filenames = [];

            for (var i = 0; i < filenamesArray.length; i++)
            {
                for (var j = 0; j < filenamesArray[i].length; j++)
                {
                    filenames.push(filenamesArray[i][j]);
                }
            }

            callback(err, filenames);
        });
    };

    var findFileStores = function(filePath, callback)
    {
        var fns = [];

        var matchingStores = [];

        for (var i = 0; i < stores.length; i++) {

            var fn = function(store, filePath, matchingStores) {
                return function(done) {
                    store.existsFile(filePath, function(exists) {

                        if (exists) {
                            matchingStores.push(store);
                        }

                        done();
                    });
                }
            }(stores[i], filePath, matchingStores);

            fns.push(fn);
        }

        async.series(fns, function(err) {
            callback(err, matchingStores);
        });

    };

    r.sendFile = function(res, filePath, cacheInfo, callback)
    {
        findFileStores(filePath, function(err, stores) {

            if (err) {
                callback(err);
                return;
            }

            if (stores.length == 0) {
                callback();
                return;
            }

            stores[0].sendFile(res, filePath, cacheInfo, function(err) {
                callback(err);
            });
        });
    };

    r.downloadFile = function(res, filePath, filename, cacheInfo, callback)
    {
        findFileStores(filePath, function(err, stores) {

            if (err) {
                callback(err);
                return;
            }

            if (stores.length == 0) {
                callback();
                return;
            }

            stores[0].downloadFile(res, filePath, filename, cacheInfo, function(err) {
                callback(err);
            });
        });
    };

    r.writeFile = function(filePath, data, callback)
    {
        // TODO: not implemented
        callback();
    };

    r.readFile = function(path, callback)
    {
        findFileStores(path, function(err, stores) {

            if (err) {
                callback(err);
                return;
            }

            if (stores.length == 0) {
                callback();
                return;
            }

            stores[0].readFile(path, function(err, data) {
                callback(err, data);
            });
        });
    };

    r.watchDirectory = function(directoryPath, onChange)
    {
        findFileStores(directoryPath, function(err, stores) {

            if (err) {
                return;
            }

            if (stores.length == 0) {
                return;
            }

            var fns = [];
            for (var i = 0; i < stores.length; i++)
            {
                var fn = function(s, directoryPath) {
                    return function(done) {
                        s.watchDirectory(directoryPath, onChange);
                        done();
                    }
                }(stores[i], directoryPath);
                fns.push(fn);
            }
            async.series(fns, function() {
                // done
            });
        });
    };

    r.moveFile = function(originalFilePath, newFilePath, callback)
    {
        // TODO: not implemented
        callback();
    };

    r.readStream = function(filePath, callback)
    {
        findFileStores(filePath, function(err, stores) {

            if (err) {
                callback(err);
                return;
            }

            if (stores.length == 0) {
                return;
            }

            stores[0].readStream(filePath, function(err, stream) {
                callback(err, stream);
            });
        });
    };

    r.writeStream = function(filePath, callback)
    {
        // TODO: not implemented
        callback();
    };

    r.fileStats = function(filePath, callback)
    {
        findFileStores(filePath, function(err, stores) {

            if (err) {
                callback(err);
                return;
            }

            if (stores.length === 0) {
                return;
            }

            stores[0].fileStats(filePath, function(err, stats) {
                callback(err, stats);
            });
        });
    };

    r.matchFiles = function(directoryPath, pattern, callback)
    {
        var fns = [];

        for (var i = 0; i < stores.length; i++) {

            var fn = function(store, directoryPath, pattern) {
                return function(done) {
                    store.matchFiles(directoryPath, pattern, function(err, matches) {
                        done(err, matches);
                    });
                }
            }(stores[i], directoryPath, pattern);

            fns.push(fn);
        }

        async.series(fns, function(err, matchesArray) {

            if (err) {
                callback(err);
                return;
            }

            var matches = [];

            for (var i = 0; i < matchesArray.length; i++)
            {
                for (var j = 0; j < matchesArray[i].length; j++)
                {
                    matches.push(matchesArray[i][j]);
                }
            }

            callback(err, matches);
        });
    };

    // specific to multistore

    r.getOriginalStores = function()
    {
        return originalStores;
    };

    return r;
};

