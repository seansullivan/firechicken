var cli = require('cli').enable('status', 'version'),
    pjson = require('./package.json'),
    fs = require('fs'),
    check = require('./check.js'),
    mail = require('./mail.js'),
    _ = require('lodash');

var app = function () {
    cli.enable('version');
    cli.setUsage('node start.js -c <config json>');
    cli.setApp('FirechickenDaemon', pjson.version);
    cli.parse({
        'debug': true,
        'config': ['c', 'Configuration file path', 'path', './config.json']
    });

    cli.main(function (args, options) {
        // attemp to get config file
        var conf, // hold conf json
            checks = [], // list of checks to perform
            tmpCheck = null,
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
                conf = JSON.parse(fs.readFileSync(options.config, 'utf-8'));
            }
            catch(e) {
                cli.debug("Error parsing config file: "+e+"");
            }
        }
        else {
            cli.fatal("Can't find a config file");
        }

        cli.debug('Enabling logging');

        journal = require('./contact_journal')(conf);

        /**
         * Search for individuals to notiy by their id
         */
        findRecipientById = function(id) {
            for(j=0; j < conf.subscribers.length; j++) {
                if(conf.subscribers[j].id == id) {
                    return conf.subscribers[j];
                }
            }

            return false;
        };

        // build check objects from config data
        for(k in conf.checks) {
            tmpCheck = new check(conf.checks[k]);

            // check object needs to know what server to connect to
            tmpCheck.setServer(conf.graphite);

            // listener for notify event, will trigger email (or any other supported forms of notification)
            tmpCheck.on('notify', function(value) {
                // stash id of check
                var checkId = k,
                    check = this;

                // iterate through subscribers for this check and notify them
                _.forEach(tmpCheck.options.subscribers, function (subscriberId) {
                    // determine if subscriber was recently contacted about this issue
                    try {
                        if(!journal.shouldContact(subscriberId, checkId)) {
                            cli.info("Not contacting subscriber about this check again.");
                            return;
                        }

                        cli.info("Contacting subscriber about metric check.");
                        journal.logContact(subscriberId, checkId);

                        recipient = findRecipientById(subscriberId);

                        // only email is supported currently
                        if(recipient.type == 'email') {
                            mailer = new mail(conf.notify.email, recipient.address, check.options.stat, value);

                            if(conf.notify.email.active === true) {
                                mailer.send();

                                journal.logContact(subscriberId, checkId);
                            }
                            else {
                                cli.debug("Mail not sent due to active configuration set to false");
                            }
                        }
                        else {
                            cli.error("Invalid notification type");
                        }
                    }
                    catch (e) {
                        cli.debug(e.message);
                    }

                });
            });

            checks.push(tmpCheck);
        }

        setInterval(function () {
            cli.debug("Processing stat checks");

            for(var m=0; m < checks.length; m++) {
                checks[m].exec();
            }
        }, conf.rate);
    });

    cli.info("Firechicken started.");
};

app();