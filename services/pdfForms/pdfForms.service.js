"use strict;";
const DBmixin = require("../../mixins/db/connection.mixin.js");
const modelRelationsmixin = require("../../mixins/db/modelRelations.mixin.js");
const cron = require("node-cron");
const CacheCleanerMixin = require("../../mixins/cache.cleaner.mixin.js");
const helperMixin = require("../../mixins/helper.mixin.js");
const s3Mixin = require("../../mixins/libs/s3.mixin.js");
const {
	sendReminderParams,
	sendResendParams,
	voidFormParams,
	deleteFormParams,
	saveToTemplateParams,
	getAllFieldsParams,
	deleteTemplateParams,
	deleteFileFromS3Params,
	addFormTagsParams,
	checkIfTemplateExistsParams,
	declineFormParams,
	validateFormTokenParams,
	activityHistoryParams,
	getUserFieldsParams,
	updateRecipientStatusParams,
	verifyPdfTokenParams,
	uploadPdfParams,
	checkDuplicateFilesParams,
	fillFormParams,
	editPdfParams,
	extendExpirationDateParams,
	getUserSignatureParams,

} = require("./pdfForms.params.js");
const {
	editPdf,
	getUserFields,
	validateFormToken,
	fillFormFields,
	getAllSubmissions,
	sendEmailReminder,
	removeFilesOfDeletedForms,
	getAllFiles,
	uploadPdfFile,
	deleteFile,
	checkDuplicateFile,
	voidForm,
	getAllFields,
	deleteForm,
	resendEmails,
	activityHistory,
	deleteFileFromS3,
	checkExpiration,
	saveToTemplate,
	checkIfTemplateExists,
	addFormTags,
	getAllTags,
	verifyPDFToken,
	declineForm,
	updateRecipientStatus,
	sendReminderToRecipients,
	extendExpirationDate,
	getUserSignature,
		selfSign
} = require("./pdfForms.methods.js");

/**
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema Moleculer's Service Schema
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 */

/** @type {ServiceSchema} */
module.exports = {
	name: "pdfForms",
	settings: {},
	mixins: [
		DBmixin("pdfForms"),
		modelRelationsmixin,
		helperMixin,
		s3Mixin,
		CacheCleanerMixin(["pdfForms"]),
	],
	setModelsAndBroker(req) {
		this.settings.models = req.settings.models;
		this.broker = req.broker;
		this.sendEmail = req.sendEmail;
	},
	model: {},
	dependencies: [],

	actions: {
		// Refactored actions
		editPdf: {
			params: editPdfParams,
			handler: editPdf,
		},
		fillFormFields: {
			// params:fillFormParams,
			authorization: false,
			handler: fillFormFields,
		},
		getAllSubmissions: {
			handler: getAllSubmissions,
		},
		getAllFiles: {
			handler: getAllFiles,
		},
		uploadPdfFile: {
			params: uploadPdfParams,
			handler: uploadPdfFile,
		},
		checkDuplicateFile: {
			params: checkDuplicateFilesParams,
			handler: checkDuplicateFile,
		},
		getUserFields: {
			params: getUserFieldsParams,
			authorization: false,
			handler: getUserFields,
		},
		validateFormToken: {
			params: validateFormTokenParams,
			authorization: false,
			handler: validateFormToken,
		},
		getAllTags: {
			// No need validation
			handler: getAllTags,
		},
		deleteFile: {
			params: deleteTemplateParams,
			handler: deleteFile,
		},
		voidForm: {
			params: voidFormParams,
			handler: voidForm,
		},
		getAllFields: {
			params: getAllFieldsParams,
			handler: getAllFields,
		},
		deleteForm: {
			params: deleteFormParams,
			handler: deleteForm,
		},
		resendEmails: {
			params: sendResendParams,
			handler: resendEmails,
		},
		activityHistory: {
			params: activityHistoryParams,
			handler: activityHistory,
		},
		deleteFileFromS3: {
			params: deleteFileFromS3Params,
			handler: deleteFileFromS3,
		},
		saveToTemplate: {
			params: saveToTemplateParams,
			handler: saveToTemplate,
		},
		checkIfTemplateExists: {
			params: checkIfTemplateExistsParams,
			handler: checkIfTemplateExists,
		},
		addFormTags: {
			params: addFormTagsParams,
			handler: addFormTags,
		},
		verifyPDFToken: {
			// params: verifyPdfTokenParams,
			authorization: false,
			handler: verifyPDFToken,
		},
		declineForm: {
			authorization: false,
			params: declineFormParams,
			handler: declineForm,
		},
		updateRecipientStatus: {
			params: updateRecipientStatusParams,
			handler: updateRecipientStatus,
		},
		sendReminderToRecipients: {
			params: sendReminderParams,
			handler: sendReminderToRecipients,
		},
		//cron
		sendEmailReminder: {
			handler: sendEmailReminder,
		},
		// corn
		removeFilesOfDeletedForms: {
			handler: removeFilesOfDeletedForms,
		},
		// cron jobs
		checkExpiration: {
			handler: checkExpiration,
		},
		extendExpirationDate: {
			params: extendExpirationDateParams,
			handler: extendExpirationDate,
		},
		getUserSignature: {
			params: getUserSignatureParams,
			handler: getUserSignature,
		},
		selfSignForm:{
			handler: selfSign,
		}
	},
	events: {},
	created() {},

	pdfFormCrons: {},

	async started() {
		const cronJobs = [
			{
				name: "pdfFormSendReminderCron",
				schedule: "0 0 * * *",
				action: "pdfForms.sendEmailReminder",
				log: "Send reminder cron",
			},
			{
				name: "pdfFormCheckExpirationCron",
				schedule: "0 0 * * *",
				action: "pdfForms.checkExpiration",
				log: "Check expiration cron",
			},
			{
				name: "pdfFormRemoveFilesCron",
				schedule: "0 0 * * *",
				action: "pdfForms.removeFilesOfDeletedForms",
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
