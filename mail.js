var nodemailer = require('nodemailer'),
    cli = require('cli'),
    events = require('events');

var mail = function (config, recipient, stat, val) {
    this.config = config;

    this.recipient = recipient;
    this.subject = "Erorr reported for: "+stat;

    this.body = "Firechicken has detected an error condition:\n\n \
     " + stat + " has reported a value of " + val.toString();
};

mail.prototype = new events.EventEmitter();

mail.prototype.send = function () {
    var self = this,
        mailOptions = {
            from: this.config.sender,
            to: this.recipient,
            subject: this.subject,
            html: this.body
        },
        transporter = null;

    if(this.config.aws) {
        transporter = nodemailer.createTransport("SES", {
            AWSAccessKeyID: this.config.aws.key,
            AWSSecretKey: this.config.aws.secret
        });
    }
    else {
        transporter = nodemailer.createTransport();
    }

    transporter.sendMail(mailOptions, function(error, response) {
        if(error) {
            cli.error(error);
        }
        else {
            cli.debug("Sent email to " + self.recipient);
        }

        transporter.close(); // shut down the connection pool, no more messages
    });
};

module.exports = mail;