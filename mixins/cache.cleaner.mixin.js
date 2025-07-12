"use strict";

module.exports = function (eventNames) {
 const events = {};

 //clear cache for all the services in eventNames

 eventNames.forEach((name) => {
  events[`${name}.cache.clean`] = async function (data) {
   const key = data.key;
   try {
    if (this.broker.cacher) {
     await this.broker.cacher.clean(key);
     this.logger.info(
      `cache key ${key} cleared for ${name} service`
     );
    }
   } catch (err) {
    this.logger.info(name + "cache clean event error----", err);
   }
  };
 });

 return {
  events,
 };
};