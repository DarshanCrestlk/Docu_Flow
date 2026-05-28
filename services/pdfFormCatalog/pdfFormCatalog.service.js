"use strict";

/**
 * PDF catalog & read APIs — submissions, fields, history, templates, tags.
 */
const pdfFormsBaseMixin = require("../pdfForms/shared/pdfFormsBase.mixin.js");
const {
	getAllFieldsParams,
	saveToTemplateParams,
	checkIfTemplateExistsParams,
	activityHistoryParams,
	addFormTagsParams,
} = require("../pdfForms/pdfForms.params.js");
const {
	getAllSubmissions,
	getAllFields,
	activityHistory,
	saveToTemplate,
	checkIfTemplateExists,
	addFormTags,
	getAllTags,
} = require("../pdfForms/pdfForms.methods.js");

module.exports = {
	name: "pdfFormCatalog",

	settings: {},

	mixins: [pdfFormsBaseMixin],

	dependencies: [],

	actions: {
		/** Paginated sent/received submissions for dashboard. */
		getAllSubmissions: { handler: getAllSubmissions },

		/** Load form/template field layout for editor or preview. */
		getAllFields: {
			params: getAllFieldsParams,
			handler: getAllFields,
		},

		/** Paginated audit/activity timeline for a form. */
		activityHistory: {
			params: activityHistoryParams,
			handler: activityHistory,
		},

		/** Save completed form as reusable template. */
		saveToTemplate: {
			params: saveToTemplateParams,
			handler: saveToTemplate,
		},

		/** Check template title uniqueness. */
		checkIfTemplateExists: {
			params: checkIfTemplateExistsParams,
			handler: checkIfTemplateExists,
		},

		/** Create or link tags on draft/upload. */
		addFormTags: {
			params: addFormTagsParams,
			handler: addFormTags,
		},

		/** List tags for tenant. */
		getAllTags: { handler: getAllTags },
	},

	events: {},
	created() {},
	async started() {},
	async stopped() {},
};
