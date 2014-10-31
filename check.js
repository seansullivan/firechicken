var events = require('events'),
    http = require('http'),
    cli = require('cli'),
    _ = require('lodash'),
    request = require('superagent'),
    util = require('util');

var check = function (config) {
    this.options = config;
    this.server = {};
    this.lastStatus = null;
    this.lastValue = null;
};

check.prototype = new events.EventEmitter();

check.prototype.setServer = function (conf) {
    this.server = conf;
};

check.prototype.exec = function () {
    if(!this.server.host || !this.server.port) {
        cli.debug('Server data not set for check');
        return false;
    }

    var self = this,
        options,
        responseBody = '',
        req;

    options = {
        host: this.server.host,
        port: this.server.port,
        path: '/render?target='+this.options.stat+'&rawData=true&from=-5min',
        method: 'GET'
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
        i,
        condition;

    try {
        values = body.split('|')[1].split(',');

        // parse every value to a float
        values = _.map(values, parseFloat);

        value = _.max(values);
    }
    catch(e) {
        cli.debug('Could not parse response, unexpected format');
    }

    this.lastValue = value;

    if(value === null || !_.isNumber(value)) {
        cli.error('No valid value for stat: '+this.options.stat);
        return;
    }

    if(this.options.condition) {
        cli.debug(util.format("Checking stat: %s with condition: %s and value of: %d", this.options.stat, this.options.condition, value));
        condition = this.options.condition.replace(/x/, value);

        try {
            if(eval(condition)) {
                cli.error("ERROR condition detected for " + this.options.stat + " with a value of " + value);

                this.lastStatus = 'ERROR';
                this.emit('notify', value);
            }
            else {
                this.lastStatus = 'NORMAL';
            }
        }
        catch (e) {
            cli.error("Unable to evaluate condition for check: "+e.message);
            this.lastStatus = null;
        }
    }
    else {
        cli.error('No condition given for stat');
        this.lastStatus = null;
    }
};

module.exports = check;