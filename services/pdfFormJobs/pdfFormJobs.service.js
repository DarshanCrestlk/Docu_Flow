"use strict";

const cron = require("node-cron");
const pdfFormsBaseMixin = require("../pdfForms/shared/pdfFormsBase.mixin.js");
const {
	checkExpiration,
	removeFilesOfDeletedForms,
} = require("../pdfForms/pdfForms.methods.js");

/**
 * Background jobs for PDF forms — expiration, retention, scheduled reminders.
 * Run on dedicated worker nodes in production.
 */
module.exports = {
	name: "pdfFormJobs",

	settings: {},

	mixins: [pdfFormsBaseMixin],

	dependencies: [],

	actions: {
		/** Cron: mark expired forms and notify parties. */
		checkExpiration: { handler: checkExpiration },

		/** Cron: purge S3/files for soft-deleted forms past retention. */
		removeFilesOfDeletedForms: { handler: removeFilesOfDeletedForms },
	},

	events: {},
	created() {},

	pdfFormCrons: {},

	async started() {
		const cronJobs = [
			{
				name: "pdfFormSendReminderCron",
				schedule: "0 0 * * *",
				action: "pdfFormNotify.sendEmailReminder",
				log: "Send reminder cron",
			},
			{
				name: "pdfFormCheckExpirationCron",
				schedule: "0 0 * * *",
				action: "pdfFormJobs.checkExpiration",
				log: "Check expiration cron",
			},
			{
				name: "pdfFormRemoveFilesCron",
				schedule: "0 0 * * *",
				action: "pdfFormJobs.removeFilesOfDeletedForms",
				log: "Remove files cron",
			},
		];

		this.pdfFormCrons = cronJobs.reduce((acc, job) => {
			acc[job.name] = cron.schedule(job.schedule, async () => {
				console.log(job.log);
				try {
					await this.broker.call(job.action);
				} catch (error) {
					console.error(`Error executing ${job.log}:`, error);
				}
			});
			return acc;
		}, {});
	},

	async stopped() {
		Object.values(this.pdfFormCrons).forEach((cronJob) => cronJob.stop());
	},
};
