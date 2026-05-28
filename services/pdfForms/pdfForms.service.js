"use strict";

/**
 * PDF forms API facade — backward-compatible `pdfForms.*` action names.
 * Delegates to domain services for independent scaling (compose, signing, files, etc.).
 *
 * In production you may run only subdomain services on dedicated nodes and omit this facade.
 */
const cron = require("node-cron");
const modelRelationsmixin = require("../../mixins/db/modelRelations.mixin.js");
const CacheCleanerMixin = require("../../mixins/cache.cleaner.mixin.js");
const { delegateAction } = require("./shared/delegateAction.js");
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
	uploadPdfParams,
	checkDuplicateFilesParams,
	editPdfParams,
	extendExpirationDateParams,
	getUserSignatureParams,
} = require("./pdfForms.params.js");

module.exports = {
	name: "pdfForms",

	settings: {},

	mixins: [modelRelationsmixin, CacheCleanerMixin(["pdfForms"])],

	setModelsAndBroker(req) {
		this.settings.models = req.settings.models;
		this.broker = req.broker;
	},

	dependencies: [
		"pdfFormCompose",
		"pdfFormSigning",
		"pdfFormFiles",
		"pdfFormNotify",
		"pdfFormJobs",
		"pdfFormCatalog",
		"pdfFormLifecycle",
	],

	actions: {
		editPdf: delegateAction("pdfFormCompose", "editPdf", {
			params: editPdfParams,
		}),
		fillFormFields: delegateAction("pdfFormSigning", "fillFormFields", {
			authorization: false,
		}),
		getUserFields: delegateAction("pdfFormSigning", "getUserFields", {
			params: getUserFieldsParams,
			authorization: false,
		}),
		validateFormToken: delegateAction("pdfFormSigning", "validateFormToken", {
			params: validateFormTokenParams,
			authorization: false,
		}),
		verifyPDFToken: delegateAction("pdfFormSigning", "verifyPDFToken", {
			authorization: false,
		}),
		declineForm: delegateAction("pdfFormSigning", "declineForm", {
			params: declineFormParams,
			authorization: false,
		}),
		updateRecipientStatus: delegateAction(
			"pdfFormSigning",
			"updateRecipientStatus",
			{ params: updateRecipientStatusParams }
		),
		getUserSignature: delegateAction("pdfFormSigning", "getUserSignature", {
			params: getUserSignatureParams,
		}),
		selfSignForm: delegateAction("pdfFormSigning", "selfSignForm"),
		extendExpirationDateByToken: delegateAction(
			"pdfFormSigning",
			"extendExpirationDateByToken"
		),

		getAllSubmissions: delegateAction("pdfFormCatalog", "getAllSubmissions"),
		getAllFields: delegateAction("pdfFormCatalog", "getAllFields", {
			params: getAllFieldsParams,
		}),
		activityHistory: delegateAction("pdfFormCatalog", "activityHistory", {
			params: activityHistoryParams,
		}),
		saveToTemplate: delegateAction("pdfFormCatalog", "saveToTemplate", {
			params: saveToTemplateParams,
		}),
		checkIfTemplateExists: delegateAction(
			"pdfFormCatalog",
			"checkIfTemplateExists",
			{ params: checkIfTemplateExistsParams }
		),
		addFormTags: delegateAction("pdfFormCatalog", "addFormTags", {
			params: addFormTagsParams,
		}),
		getAllTags: delegateAction("pdfFormCatalog", "getAllTags"),

		getAllFiles: delegateAction("pdfFormFiles", "getAllFiles"),
		uploadPdfFile: delegateAction("pdfFormFiles", "uploadPdfFile", {
			params: uploadPdfParams,
		}),
		checkDuplicateFile: delegateAction("pdfFormFiles", "checkDuplicateFile", {
			params: checkDuplicateFilesParams,
		}),
		deleteFile: delegateAction("pdfFormFiles", "deleteFile", {
			params: deleteTemplateParams,
		}),
		deleteFileFromS3: delegateAction("pdfFormFiles", "deleteFileFromS3", {
			params: deleteFileFromS3Params,
		}),

		voidForm: delegateAction("pdfFormLifecycle", "voidForm", {
			params: voidFormParams,
		}),
		deleteForm: delegateAction("pdfFormLifecycle", "deleteForm", {
			params: deleteFormParams,
		}),
		extendExpirationDate: delegateAction(
			"pdfFormLifecycle",
			"extendExpirationDate",
			{ params: extendExpirationDateParams }
		),

		resendEmails: delegateAction("pdfFormNotify", "resendEmails", {
			params: sendResendParams,
		}),
		sendReminderToRecipients: delegateAction(
			"pdfFormNotify",
			"sendReminderToRecipients",
			{ params: sendReminderParams }
		),
		sendEmailReminder: delegateAction("pdfFormNotify", "sendEmailReminder"),

		checkExpiration: delegateAction("pdfFormJobs", "checkExpiration"),
		removeFilesOfDeletedForms: delegateAction(
			"pdfFormJobs",
			"removeFilesOfDeletedForms"
		),
	},

	events: {},
	created() {},

	/**
	 * Optional: enable facade crons when pdfFormJobs is not deployed.
	 * Default: crons run on pdfFormJobs service only.
	 */
	pdfFormCrons: {},

	async started() {
		if (process.env.PDF_FORMS_FACADE_CRONS === "true") {
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
		}
	},

	async stopped() {
		Object.values(this.pdfFormCrons).forEach((cronJob) => cronJob?.stop?.());
	},
};
