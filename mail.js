var nodemailer = require('nodemailer'),
    cli = require('cli'),
    events = require('events');

var mail = function (config, recipient, stat, val) {
    this.config = config;

    nodemailer.SMTP = {
        host: config.host,
        port: config.port
    };

    this.recipient = recipient;
    this.subject = "Erorr reported for: "+stat;

    this.body = "Firechicken has detected an error condition:\n\n \
     " + stat + " has reported a value of " + val.toString();
};

mail.prototype = new events.EventEmitter();

mail.prototype.send = function () {
    var self = this;

    nodemailer.send_mail(
        {
            sender: this.config.sender,
            to:this.recipient,
            subject:this.subject,
            body:this.body
        },
        function(error, success){
            if(success) {
                cli.debug("Sent email to " + self.recipient);
            }
            else {
                cli.error("Sending email failed: " + error.message);
            }
        }
    );
};

module.exports = mail;