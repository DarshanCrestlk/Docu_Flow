module.exports = {
	"GET /~node/actions": "$node.actions",
	"GET /~node/options": "$node.options",
	"GET /~node/services": "$node.services",
	"GET /~node/list": "$node.list",

	//Auth apis
	"POST /auth/login": "auth.login",
	"POST /auth/signup": "auth.signup",

	// s3 apis
	//s3
	"POST /s3/upload": "s3.uploadToS3",
	"POST /s3/update": "s3.updateToS3",
	"POST /s3/stream": "s3.streamFileData",
	"POST /s3/signed-url": "s3.getSignedURL", // for Ms office AddIns
	// "POST /s3/delete": "s3.deleteFileFromS3",
	"GET /s3/delete-unused-files": "s3.deleteUnUsedFiles",
	"POST /s3/add-unusedFile": "s3.addUnUsedFile",

	// //Documents Office apis (Ms Office AddIn service)
	// "GET /office/check-app-key": "officeAddin.checkAppKey",
	// "GET /office/file-details/:id": "officeAddin.getFileDetails",
	// "PUT /office/unlock-pdf-editor": "officeAddin.unlockFileForPdfEditor",
	// "POST /office/create-new-file-versions": "officeAddin.createNewFileVersions",
	// "PUT /office/files/:id": "officeAddin.updateFile",
	// "POST /office/upload": "officeAddin.uploadDocuments",
	// "GET /office/file-versions/:id": "officeAddin.getFileVersions",
	// "DELETE /office/delete-app/:id": "officeAddin.deleteOfficeAppKey",
	// "GET /office/file-path/:id/:type": "officeAddin.getFileFolderPath",
	// "GET /office/check-available-storage/:workspace_id/total-size/:size":
	// 	"officeAddin.checkAvailableStorage",
	// "POST /office/check-file-access": "officeAddin.checkFileAccess",

	//Settings apis
	"GET /settings": "settings.getSettingsList",

	// // PDF form email library apis
	// "GET /email-library/pdf-form": "emailLibrarys.getAllPdfFormEmails",
	// "GET /email-library/pdf-form/types": "emailLibrarys.getPdfFormEmailTypes",
	// "GET /email-library/pdf-form/type/:type":
	// 	"emailLibrarys.getPdfFormEmailByType",
	// "GET /email-library/pdf-form/:id": "emailLibrarys.getPdfFormEmailById",
	// "POST /email-library/pdf-form": "emailLibrarys.createPdfFormEmail",
	// "PUT /email-library/pdf-form/:id": "emailLibrarys.updatePdfFormEmail",

	"GET /email-library/sliceseal": "emailLibrarys.getAllPdfFormEmails",
	"GET /email-library/sliceseal/types": "emailLibrarys.getPdfFormEmailTypes",
	"GET /email-library/sliceseal/type/:type":
		"emailLibrarys.getPdfFormEmailByType",
	"GET /email-library/sliceseal/:id": "emailLibrarys.getPdfFormEmailById",
	"POST /email-library/sliceseal": "emailLibrarys.createPdfFormEmail",
	"PUT /email-library/sliceseal/:id": "emailLibrarys.updatePdfFormEmail",

	//PDF Forms apis
	"POST /pdf-forms/edit-pdf-file": "pdfForms.editPdf",
	"POST /pdf-forms/validate-pass/:token": "pdfForms.validatePassWord",
	"GET /pdf-forms/user-fields/:token": "pdfForms.getUserFields",
	"POST /pdf-forms/validate-form-token/:token": "pdfForms.validateFormToken",
	"POST /pdf-forms/fill-pdf-form": "pdfForms.fillFormFields",
	"POST /pdf-forms/fill-pdf-form-sign": "pdfForms.fillFormFields",
	"GET /pdf-forms/submissions-file": "pdfForms.getAllSubmissions",
	"POST /pdf-forms/submission-reminder": "pdfForms.sendEmailReminder",
	"GET /pdf-forms/expiration": "pdfForms.checkExpiration",
	"GET /pdf-forms/files": "pdfForms.getAllFiles",
	"POST /pdf-forms/upload": "pdfForms.uploadPdfFile",
	"DELETE /pdf-forms/destroy/:id": "pdfForms.deleteFile",
	"POST /pdf-forms/check-duplicate": "pdfForms.checkDuplicateFile",
	"POST /pdf-forms/void": "pdfForms.voidForm",
	"GET /pdf-forms/:id/type/:mode": "pdfForms.getAllFields",
	"DELETE /pdf-forms/:id": "pdfForms.deleteForm",
	"POST /pdf-forms/resend": "pdfForms.resendEmails",
	"GET /pdf-forms/activity-history/:id": "pdfForms.activityHistory",
	"POST /pdf-forms/delete-file-s3": "pdfForms.deleteFileFromS3",
	"POST /pdf-forms/save-to-template": "pdfForms.saveToTemplate",
	"POST /pdf-forms/check-template-exists": "pdfForms.checkIfTemplateExists",
	"POST /pdf-forms/verify-token": "pdfForms.verifyPDFToken",
	"POST /pdf-forms/add-tags": "pdfForms.addFormTags",
	"GET /pdf-forms/tags": "pdfForms.getAllTags",
	"POST /pdf-forms/decline": "pdfForms.declineForm",
	"POST /pdf-forms/update-recipient-mail-status":
		"pdfForms.updateRecipientStatus",
	"POST /pdf-forms/send-reminder": "pdfForms.sendReminderToRecipients",
	"POST /pdf-forms/heart-beat": "documents.heartBeat",
	"POST /pdf-forms/extend-expiration": "pdfForms.extendExpirationDate",
	"POST /pdf-forms/verify-expiration-token":
		"pdfForms.extendExpirationDateByToken",
	"GET /pdf-forms/signature/:id/:email": "pdfForms.getUserSignature",
	"POST /pdf-forms/self-sign": "pdfForms.selfSignForm",
	// "POST /addAuditLog": "pdfForms.addAuditLog",



	"POST /send-ses-email-slice-seal": "sesEmail.sendSliceSealForm",
	"POST /ses-event-slice-seal": "sesEmail.trackEventSliceSealForm",

};
