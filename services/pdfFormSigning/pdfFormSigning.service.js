"use strict";

/**
 * PDF signing & recipient-facing service — public token flows and field completion.
 * Scale separately from compose; typically the highest load under signing peaks.
 */
const pdfFormsBaseMixin = require("../pdfForms/shared/pdfFormsBase.mixin.js");
const {
	validateFormTokenParams,
	getUserFieldsParams,
	declineFormParams,
	getUserSignatureParams,
	updateRecipientStatusParams,
} = require("../pdfForms/pdfForms.params.js");
const {
	fillFormFields,
	getUserFields,
	validateFormToken,
	verifyPDFToken,
	declineForm,
	updateRecipientStatus,
	getUserSignature,
	selfSign,
	extendExpirationDateByToken,
} = require("../pdfForms/pdfForms.methods.js");

module.exports = {
	name: "pdfFormSigning",

	settings: {},

	mixins: [pdfFormsBaseMixin],

	dependencies: [],

	actions: {
		/**
		 * Recipient completes assigned fields, applies signatures, updates PDF in S3.
		 * Use cases: multipart sign flow, digital signature, audit trail, completion emails.
		 */
		fillFormFields: {
			authorization: false,
			handler: fillFormFields,
		},

		/**
		 * Load form field definitions for a recipient token (signer UI).
		 */
		getUserFields: {
			params: getUserFieldsParams,
			authorization: false,
			handler: getUserFields,
		},

		/**
		 * Validate recipient token on open; optional view audit.
		 */
		validateFormToken: {
			params: validateFormTokenParams,
			authorization: false,
			handler: validateFormToken,
		},

		/**
		 * Resolve company from PDF token (used by S3 upload middleware).
		 */
		verifyPDFToken: {
			authorization: false,
			handler: verifyPDFToken,
		},

		/**
		 * Recipient declines to sign with reason.
		 */
		declineForm: {
			authorization: false,
			params: declineFormParams,
			handler: declineForm,
		},

		/**
		 * Webhook-style recipient status updates (e.g. SES bounce).
		 */
		updateRecipientStatus: {
			params: updateRecipientStatusParams,
			handler: updateRecipientStatus,
		},

		/**
		 * Fetch saved signature/initial assets for a user.
		 */
		getUserSignature: {
			params: getUserSignatureParams,
			handler: getUserSignature,
		},

		/**
		 * Creator self-sign without full recipient flow.
		 */
		selfSignForm: {
			handler: selfSign,
		},

		/**
		 * Extend expiration via public token link.
		 */
		extendExpirationDateByToken: {
			handler: extendExpirationDateByToken,
		},
	},

	events: {},
	created() {},
	async started() {},
	async stopped() {},
};
