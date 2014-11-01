var cli = require('cli').enable('status', 'version'),
    pjson = require('./package.json'),
    fs = require('fs'),
    mail = require('./mail'),
    _ = require('lodash'),
    util = require('util');

(function () {
    cli.enable('version');
    cli.setUsage('node start.js -c <config json>');
    cli.setApp('FirechickenDaemon', pjson.version);
    cli.parse({
        'debug': true,
        'config': ['c', 'Configuration file path', 'path', './config.json']
    });

    cli.main(function (args, options) {
        // attemp to get config file
        var config, // hold config json
            checks = [], // list of checks to perform
            // tmpCheck = null,
            recipient, // temp recipient value
            mailer, // object of mail object before sending
            findRecipientById, // helper function fore searching for a subscriber by their id
            j, // iterate over notify list
            k, // iterate over checks in conf to construct check objects
            l, // iterate over subscribers to check when "notify" event fires
            alertsSent = {},
            journal;

        if(fs.existsSync(options.config)) { // first thing, load conf
            try { // wrap in try/catch since config could be invalid
                config = JSON.parse(fs.readFileSync(options.config, 'utf-8'));
            }
            catch(e) {
                cli.debug("Error parsing config file: "+e+"");
            }
        }
        else {
            cli.fatal("Can't find a config file");
        }

        cli.debug('Enabling logging');

        // Now that we have the config, can load the check lib
        check = require('./check.js')(config);

        // build check objects from config data
        for(k in config.checks) {
            var tmpCheck = new check(config.checks[k], k);
            checks.push(tmpCheck);
        }

        var runChecks = function () {
            cli.debug("Processing stat checks");

            _.forEach(checks, function (check) {
                check.exec();
            });
        };

        runChecks();
        setInterval(runChecks, config.rate);
    });

    cli.info("Firechicken started.");
})();