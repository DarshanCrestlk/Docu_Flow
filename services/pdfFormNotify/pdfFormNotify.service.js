"use strict";

/**
 * PDF notification service — resend, reminders, outbound email orchestration.
 */
const pdfFormsBaseMixin = require("../pdfForms/shared/pdfFormsBase.mixin.js");
const { sendReminderParams, sendResendParams } = require("../pdfForms/pdfForms.params.js");
const {
	resendEmails,
	sendReminderToRecipients,
	sendEmailReminder,
} = require("../pdfForms/pdfForms.methods.js");

module.exports = {
	name: "pdfFormNotify",

	settings: {},

	mixins: [pdfFormsBaseMixin],

	dependencies: [],

	actions: {
		/** Resend signing emails to selected or all pending recipients. */
		resendEmails: {
			params: sendResendParams,
			handler: resendEmails,
		},

		/** Manual reminder for a specific form. */
		sendReminderToRecipients: {
			params: sendReminderParams,
			handler: sendReminderToRecipients,
		},

		/** Cron: automated reminder emails based on settings. */
		sendEmailReminder: {
			handler: sendEmailReminder,
		},
	},

	events: {},
	created() {},
	async started() {},
	async stopped() {},
};
