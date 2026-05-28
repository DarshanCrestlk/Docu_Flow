"use strict";

/**
 * PDF form composition service — create, edit, duplicate, initiate forms/templates.
 * Scale this node independently under high compose/edit traffic.
 *
 * @see services/pdfForms/pdfForms.methods.js (editPdf and compose helpers)
 */
const pdfFormsBaseMixin = require("../pdfForms/shared/pdfFormsBase.mixin.js");
const { editPdfParams } = require("../pdfForms/pdfForms.params.js");
const { editPdf } = require("../pdfForms/pdfForms.methods.js");

module.exports = {
	name: "pdfFormCompose",

	settings: {},

	mixins: [pdfFormsBaseMixin],

	dependencies: [],

	actions: {
		/**
		 * Create or update a PDF form/template: recipients, fields, tags, emails, audit.
		 * Use cases: draft save, send for signature, edit in-flight form, duplicate, initiate from template.
		 */
		editPdf: {
			params: editPdfParams,
			handler: editPdf,
		},
	},

	events: {},
	created() {},
	async started() {},
	async stopped() {},
};
