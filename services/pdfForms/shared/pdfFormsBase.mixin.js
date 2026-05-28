"use strict";

const modelRelationsmixin = require("../../../mixins/db/modelRelations.mixin.js");
const helperMixin = require("../../../mixins/helper.mixin.js");
const s3Mixin = require("../../../mixins/s3.mixin.js");
const CacheCleanerMixin = require("../../../mixins/cache.cleaner.mixin.js");
const pdfFormsMethods = require("../pdfForms.methods.js");

/**
 * Shared Moleculer mixin for all PDF form domain services.
 * Provides DB models, S3, helpers, cache, and the full method library (bound to `this`).
 */
module.exports = {
	mixins: [
		modelRelationsmixin,
		helperMixin,
		s3Mixin,
		CacheCleanerMixin(["pdfForms"]),
	],
	methods: pdfFormsMethods,
	setModelsAndBroker(req) {
		this.settings.models = req.settings.models;
		this.broker = req.broker;
		this.sendEmail = req.sendEmail;
	},
};
