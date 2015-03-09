var inherits = require("inherits");
var uid2 = require("uid2");
var txtsub = require("txtsub");

var path = require("path");
var fs = require("fs");

var Adapter = require("socket.io-adapter");

module.exports = adapter;

function adapter(option)
{
    option = option || {};

    var filename = option.name;
    if (!filename) {
        filename = path.join(process.env.CLOUDCMS_TEMPDIR_PATH, "socketio-adapter.txt");
    }
    if (!fs.existsSync(filename)) {
        fs.writeFileSync(filename, "");
    }

    console.log("Socket.io adapter: " + filename);

    var client = txtsub();

    var uid = uid2(6);
    var key = "#" + uid;

    function Text(nsp)
    {
        Adapter.call(this, nsp);

        var self = this;
        client.subscribe( filename, this.onmessage.bind(this) );
        client.on("error", function(err){
            self.emit("error", err);
        });
    }
    inherits(Text, Adapter);

    Text.prototype.onmessage = function(content) {

        var diff = "";

        content.diff.forEach(function(each){

            if (each.added)
            {
                diff = each.value;
            }
        });

        if (key === diff.split("\t")[0])
        {
            // same uid
            return;
        }

        var rest = diff.split("\t")[1];
        if (!rest) {
            return;
        }

        var json = diff.split("\t")[1].split("\n")[0];

        var args = JSON.parse( json ).data;
        if (args[0] && args[0].nsp === undefined)
        {
            args[0].nsp = "/";
        }

        if (!args[0] || args[0].nsp != this.nsp.name)
        {
            // ignore different namespace
            return;
        }

        args.push(true);

        this.broadcast.apply(this, args);
    };

    Text.prototype.broadcast = function(packet, opts, remote)
    {
        Adapter.prototype.broadcast.call(this, packet, opts);

        if (!remote)
        {
            var encode = JSON.stringify( {
                data: [packet, opts]
            } );

            var str = key + "\t" + encode + "\n";
            client.publish(filename, str);
        }
    };

    return Text;
}