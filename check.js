var cli = require('cli'),
    _ = require('lodash'),
    request = require('superagent'),
    util = require('util'),
    journal = null,
    mail = require('./mail'),
    config = null,

    /**
     * Search for individuals to notiy by their id
     */
    findRecipientById = function(id) {
        for(j=0; j < config.subscribers.length; j++) {
            if(config.subscribers[j].id == id) {
                return config.subscribers[j];
            }
        }

        return false;
    };

var check = function (options, id) {
    this.options = options;
    this.server = config.graphite;
    this.id = id;
};

check.prototype.onNotify = function (value) {
    var self = this;

    // iterate through subscribers for this check and notify them
    _.forEach(this.options.subscribers, function (subscriberId) {
        // determine if subscriber was recently contacted about this issue
        try {
            if(!journal.shouldContact(subscriberId, self.id)) {
                cli.debug("Not contacting subscriber about this check again.");
                return;
            }

            cli.info(util.format("Contacting subscriber %s about metric check.", subscriberId));
            journal.logContact(subscriberId, self.id);

            recipient = findRecipientById(subscriberId);

            // only email is supported currently
            if(recipient.type == 'email') {
                mailer = new mail(config.notify.email, recipient.address, self.options.stat, value);

                if(config.notify.email.active === true) {
                    mailer.send();

                    journal.logContact(subscriberId, self.id);
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
}

check.prototype.exec = function () {
    if(!this.server.host || !this.server.port) {
        cli.debug('Server data not set for check');
        return false;
    }

    var self = this,
        options = {
            host: this.server.host,
            port: this.server.port,
            path: '/render?target='+this.options.stat+'&rawData=true&from=-'+this.options.timeAgo
        };

    // Auth currently not supported
    if(this.server.username && this.server.password) {
        options.auth = this.server.username+':'+this.server.password;
    }

    cli.debug("Sending stat retrieval request for: " + this.options.stat);

    request
        .get(options.host + options.path)
        .set('port', options.port)
        .end(function(error, result){
            if(error) {
                cli.debug("Error");
                return;
            }

            var responseBody = result.text;

            cli.debug('Stat retrieval response: ' + responseBody.trim());

            self.processResponse(responseBody);
        });
};

check.prototype.processResponse = function(body) {
    var values = null,
        value = null,
        condition;

    try {
        values = body.split('|')[1].split(',');

        // parse every value to a float
        values = _.map(values, parseFloat);
        values = _.filter(values, function(value) { return !isNaN(value); });

        if(_.isEmpty(values)) {
            cli.debug("No valid values for stat: "+this.options.stat);
            return;
        }

        value = _.max(values);
    }
    catch(e) {
        cli.debug('Could not parse response, unexpected format');
    }

    if(value === null || !_.isNumber(value)) {
        cli.error('No valid value for stat: '+this.options.stat);
        return;
    }

    if(this.options.condition) {
        cli.debug(util.format("Checking stat: %s with condition: %s and value of: %d", this.options.stat, this.options.condition, value));
        condition = this.options.condition.replace(/x/, value);

        try {
            if(eval(condition)) {
                cli.info("ERROR condition detected for " + this.options.stat + " with a value of " + value);
                this.onNotify(value);
            }
        }
        catch (e) {
            cli.error("Unable to evaluate condition for check: "+e.message);
        }
    }
    else {
        cli.error('No condition given for stat');
    }
};

module.exports = function (config_) {
    config = config_;

    journal = require('./contact_journal')(config);

    return check;
};