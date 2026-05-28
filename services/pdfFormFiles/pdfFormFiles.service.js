"use strict";

/**
 * PDF file asset service — uploads, library listing, duplicate checks, S3 cleanup.
 */
const pdfFormsBaseMixin = require("../pdfForms/shared/pdfFormsBase.mixin.js");
const {
	uploadPdfParams,
	checkDuplicateFilesParams,
	deleteTemplateParams,
	deleteFileFromS3Params,
} = require("../pdfForms/pdfForms.params.js");
const {
	getAllFiles,
	uploadPdfFile,
	checkDuplicateFile,
	deleteFile,
	deleteFileFromS3,
} = require("../pdfForms/pdfForms.methods.js");

module.exports = {
	name: "pdfFormFiles",

	settings: {},

	mixins: [pdfFormsBaseMixin],

	dependencies: [],

	actions: {
		/** List uploaded PDF files for the tenant library. */
		getAllFiles: { handler: getAllFiles },

		/** Register uploaded file metadata after S3 upload. */
		uploadPdfFile: {
			params: uploadPdfParams,
			handler: uploadPdfFile,
		},

		/** Check duplicate filename before upload. */
		checkDuplicateFile: {
			params: checkDuplicateFilesParams,
			handler: checkDuplicateFile,
		},

		/** Remove file record and linked forms/templates. */
		deleteFile: {
			params: deleteTemplateParams,
			handler: deleteFile,
		},

		/** Delete object from S3 by key. */
		deleteFileFromS3: {
			params: deleteFileFromS3Params,
			handler: deleteFileFromS3,
		},
	},

	events: {},
	created() {},
	async started() {},
	async stopped() {},
};
