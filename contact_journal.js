var _ = require('lodash');

module.exports = function (config) {
    var contactedBySubscriber = {},

        subscriberExists = function (subscriberId) {
            return _.has(contactedBySubscriber, subscriberId);
        };

    return {
        logContact: function (subscriberId, checkId) {
            if(!subscriberExists(subscriberId)) {
                contactedBySubscriber[subscriberId] = {};
            }

            // update the last time this subscriber was contacted about this check
            contactedBySubscriber[subscriberId][checkId] = Date.now();
        },

        /**
         * Is it appropriate to alert this subscriber depending on threshold
         *
         * @param  {Number} subscriberId
         * @param  {Number} checkId
         */
        shouldContact: function (subscriberId, checkId) {
            var contactThreshold = Date.now() - (config.contactFrequencyInMinutes * 60000);

            if(!subscriberExists(subscriberId) || !_.has(contactedBySubscriber[subscriberId], checkId)) {
                return true;
            }

            /**
             * Was the last time the subscriber was contacted about this check
             * before the contact threshold?  Is so, time to contact again.
             */
            return contactedBySubscriber[subscriberId][checkId] < contactThreshold;
        }
    };
};