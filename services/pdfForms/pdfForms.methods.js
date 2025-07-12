/**
 * @this {import("moleculer").Service}
 * @param {import("moleculer").Context}
 */
const RESPONSES = require("../../config/constants/messages.js");
let { Op, Transaction } = require("sequelize");
const path = require("path");
const fs = require("fs");
const { P12Signer } = require("@signpdf/signer-p12");
const { MoleculerError } = require("moleculer").Errors;
const ShortUniqueId = require("short-unique-id");
const { PDFDocument, PDFName, StandardFonts, rgb } = require("pdf-lib");
const { pdflibAddPlaceholder } = require("@signpdf/placeholder-pdf-lib");
const signpdf = require("@signpdf/signpdf").default;
const { sequelize } = require("../../mixins/db/db.js");
const axios = require("axios");
const crypto = require("crypto");
const moment = require("moment");
const { v4: uuidv4 } = require("uuid");
const fontkit = require("@pdf-lib/fontkit");
const wkhtmltopdf = require("wkhtmltopdf");
const UAParser = require("ua-parser-js");
const forge = require("node-forge");
const { documentTemplate } = require("../../templates/templates.js");

async function editPdf(ctx) {
	const t = await sequelize.transaction();
	try {
		const { randomUUID } = new ShortUniqueId({ length: 10 });
		const formData = ctx.params.formData;
		const mode = formData.mode; // create, edit, initiate, duplicate
		const contentType = formData.selectionFrom; // Form, Template
		const templateActions =
			["duplicate", "edit", "create"].includes(mode) &&
			contentType === "template";
		let isPriorityRequired = formData.priorityRequired;
		const emailTemplate = formData?.email_template;
		const emailSubject = formData?.email_subject; //  mail_subject
		let recipientsDetails = formData?.recipients; // array
		const title = formData.title;
		const previousContentId = formData.form_id || formData.templateId;
		const companyId =
			ctx?.meta?.user?.company_id || ctx?.params?.company_id;
		const isDraft = formData.isDraft;
		const tags = formData?.tags;

		const formSettings = await this.broker.call(
			"settings.getSettingsList",
			{
				company_id: companyId,
			}
		);

		const oldFormData =
			mode === "edit" && contentType === "form"
				? await this.settings.models.pdfForms.findOne({
						where: {
							company_id: companyId,
							id: previousContentId,
						},
						include: [
							{
								model: this.settings.models.users,
								attributes: ["id", "email", "full_name"],
							},
							{
								model: this.settings.models.companies,
								attributes: ["id", "name"],
							},
							{
								model: this.settings.models.pdfFormRecipients,
								where: {
									is_declined: true,
								},
								attributes: [
									"id",
									"status",
									"is_declined",
									"name",
									"email",
								],
								required: false,
							},
						],
				  })
				: null;

		if (
			mode === "edit" &&
			contentType === "form" &&
			oldFormData?.dataValues?.status !== "draft"
		) {
			isPriorityRequired = oldFormData?.is_priority_required;
		}

		if (oldFormData?.dataValues?.status === "completed") {
			t.rollback();
			return {
				code: RESPONSES.status.error,
				message: "Document has been completed, Please refresh the page",
				error: "Document has been completed, Please refresh the page",
			};
		} else if (oldFormData?.dataValues?.status === "deleted") {
			t.rollback();
			return {
				code: RESPONSES.status.error,
				message: "Document has been deleted, Please refresh the page",
				error: "Document has been deleted, Please refresh the page",
			};
		} else if (oldFormData?.dataValues?.status === "declined") {
			t.rollback();
			return {
				code: RESPONSES.status.error,
				message: `Document has been declined by ${oldFormData?.dataValues?.pdf_form_recipients?.[0]?.dataValues?.name}, Please refresh the page`,
				error: `Document has been declined  ${oldFormData?.dataValues?.pdf_form_recipients?.[0]?.dataValues?.name}, Please refresh the page`,
			};
		} else if (oldFormData?.dataValues?.status === "voided") {
			t.rollback();
			return {
				code: RESPONSES.status.error,
				message: "Document has been void, Please refresh the page",
				error: "Document has been void, Please refresh the page",
			};
		}

		if (mode === "edit" && contentType === "form" && !isDraft) {
			const oldData = await this.settings.models.pdfForms.findOne({
				where: {
					id: previousContentId,
				},
				include: [
					{
						model: this.settings.models.pdfFormRecipients,
						where: {
							status: "completed",
						},
					},
				],
			});

			const oldCompletedRecipientArr =
				oldData?.dataValues?.pdf_form_recipients;

			const providedCompletedRecipientArr = recipientsDetails?.filter(
				(recipient) => recipient?.status === "completed"
			);

			if (oldCompletedRecipientArr?.length > 0) {
				// check if oldCompletedRecipientArr is same as providedCompletedRecipientArr
				if (
					oldCompletedRecipientArr?.length !==
					providedCompletedRecipientArr?.length
				) {
					t.rollback();
					return {
						code: RESPONSES.status.error,
						message:
							"One or more recipients have completed signing. Please refresh the page",
						error: "One or more recipients have completed signing. Please refresh the page",
					};
				}

				for (const oldCompletedRecipient of oldCompletedRecipientArr) {
					// Find matching recipient in new array by email, name, type and role
					const matchingNewRecipient = recipientsDetails?.find(
						(newRecipient) =>
							newRecipient?.email ===
								oldCompletedRecipient?.email &&
							newRecipient?.name ===
								oldCompletedRecipient?.name &&
							newRecipient?.type ===
								oldCompletedRecipient?.type &&
							newRecipient?.role === oldCompletedRecipient?.role
					);

					// If matching recipient not found or status is not completed
					if (!matchingNewRecipient) {
						t.rollback();
						return {
							code: RESPONSES.status.error,
							message:
								"One or more recipients have completed signing. Please refresh the page",
							error: "One or more recipients have completed signing. Please refresh the page",
						};
					}

					if (matchingNewRecipient?.status !== "completed") {
						t.rollback();
						return {
							code: RESPONSES.status.error,
							message:
								"One or more recipients have completed signing. Please refresh the page",
							error: "One or more recipients have completed signing. Please refresh the page",
						};
					}
				}
			}
		}

		let historyArr = [];
		let fileDetails = await handleFileDetails.call(
			this,
			mode,
			contentType,
			formData,
			companyId,
			ctx,
			previousContentId
			// t
		);
		let companyData = await this.broker.call("companies.getById", {
			id: companyId,
		});
		if (mode === "edit" && contentType === "form") {
			const data = await prepareRecipientAndEditForm.call(
				this,
				fileDetails,
				oldFormData,
				previousContentId,
				companyId,
				recipientsDetails,
				title,
				ctx,
				emailSubject,
				emailTemplate,
				companyData,
				randomUUID
				// t
			);
			recipientsDetails = data?.recipientsDetails;
			fileDetails = data?.fileDetails;
			historyArr = data?.historyArr;
		}

		const formDataResp = await createOrUpdateFormData.call(
			this,
			mode,
			contentType,
			formData,
			fileDetails,
			title,
			isPriorityRequired,
			isDraft,
			previousContentId,
			companyId,
			randomUUID,
			ctx,
			formSettings,
			oldFormData
			// t
		);

		if (
			!isDraft &&
			formSettings?.data?.document_id &&
			((mode === "initiate" && contentType === "template") ||
				(mode === "create" && contentType === "form") ||
				(mode === "duplicate" && contentType === "form") ||
				(oldFormData?.dataValues?.status === "draft" &&
					mode === "edit"))
		) {
			{
				const newObj =
					oldFormData?.dataValues?.status === "draft" &&
					mode === "edit" &&
					contentType === "form"
						? {
								...oldFormData?.dataValues,
						  }
						: {
								...formDataResp?.dataValues,
						  };

				// if (contentType === "form" && (mode === "initiate" && contentType === "template")) {
				const newFile = await this.copyObject(
					{
						file_url: newObj?.file_url,
						key: newObj?.key,
						file_name: newObj?.title,
					},
					"SLICE HRMS/images/signify/forms/"
				);
				await this.settings.models.pdfForms.update(
					{
						form_original_key: newFile.key,
						form_original_url: newFile.fileUrl,
						// document_id: `DF-${randomUUID()}-${companyId}-${Date.now()}`,
					},
					{
						where: {
							id: newObj?.id,
						},
					}
				);
				// }

				await addDocumentID.call(this, newObj);
			}
		}

		const formId =
			mode === "edit" &&
			(contentType === "form" || contentType === "template")
				? previousContentId
				: formDataResp?.id;

		const recipientDataArray = await prepareRecipientData.call(
			this,
			recipientsDetails,
			isPriorityRequired,
			isDraft,
			formId,
			companyId,
			mode,
			contentType
		);

		const tokenArray = recipientDataArray.map((data) => data?.token);

		//generate signature Id for each recipient

		await addSignId.call(this, recipientDataArray, companyId, randomUUID);

		const recipientData = (
			await this.settings.models.pdfFormRecipients.bulkCreate(
				recipientDataArray.filter((data) => !("isOld" in data)),
				{
					returning: true,
					//  transaction: t
				}
			)
		)?.map((r) => r.get({ plain: true }));

		const newRecipientData =
			mode === "edit" &&
			contentType === "form" &&
			recipientsDetails?.map((rd) => {
				// if (!rd?.is_old) {
				const match = recipientData.find((rN) => rN.email === rd.email);
				return match ? match : rd;
				// }
				// return rd;
			});

		if (mode === "edit" && contentType === "form") {
			await handleEditFormFields.call(
				this,
				recipientsDetails,
				companyId,
				newRecipientData
				// t
			);
		}

		const fieldRecords = await createFieldRecords.call(
			this,
			recipientsDetails,
			companyId,
			formId,
			mode,
			contentType,
			recipientData,
			newRecipientData
			// t
		);

		await createFieldOptionsAndRadioButtons.call(
			this,
			fieldRecords,
			companyId
			// t
		);

		await createOrUpdateTags.call(this, tags, formId, mode, companyId, t);

		const recipientDataArr =
			oldFormData?.status === "draft"
				? newRecipientData.map((r) => ({
						...r,
						isDraftUser: true,
				  }))
				: recipientData;

		if (!isDraft) {
			const editHistoryArr = await sendEmailsToRecipients.call(
				this,
				formId,
				companyData,
				templateActions,
				isPriorityRequired,
				mode,
				contentType,
				recipientDataArr,
				emailTemplate,
				emailSubject,
				tokenArray,
				ctx,
				title,
				oldFormData
				// fileDetails,
				// t
			);
			historyArr = [...(historyArr || []), ...(editHistoryArr || [])];
		}

		if (mode !== "create" && mode !== "initiate" && mode !== "duplicate") {
			await createFormHistory.call(
				this,
				mode,
				isDraft,
				templateActions,
				oldFormData,
				contentType,
				formId,
				companyId,
				ctx
				// t
			);
		}
		historyArr?.length > 0 &&
			(await this.settings.models.pdfFormHistory.bulkCreate(historyArr));

		await t.commit();
		return {
			code: RESPONSES.status.success,
			message: "Form and recipients processed successfully",
		};
	} catch (error) {
		await t.rollback();
		console.log(error);
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
			error: error.message,
		};
	}
}
async function addSignId(userList, companyId, randomUUID) {
	const newUserSignatureIdsRaw = await Promise.all(
		userList.map(async (data) => {
			if (data?.type === "inside_organization") {
				const existingSignature =
					await this.settings.models.pdfFormSignatureInitials.findOne(
						{
							where: {
								email: data?.email,
								company_id: companyId,
							},
						}
					);

				if (!existingSignature) {
					return {
						email: data?.email,
						sign_uuid: `SIG-${randomUUID()}`,
						company_id: companyId,
						user_id: data?.user_id,
					};
				}
			}

			return null; // explicitly return null for clarity
		})
	);

	// Filter out null/undefined entries
	const newUserSignatureIds = newUserSignatureIdsRaw.filter(Boolean);

	// Only insert if there are new entries
	if (newUserSignatureIds.length > 0) {
		await this.settings.models.pdfFormSignatureInitials.bulkCreate(
			newUserSignatureIds
		);
	}
}

async function verifyPDFToken(ctx) {
	try {
		const directCheck = ctx.params.directCheck;
		const token = ctx.params.directCheck ? ctx.params.token : ctx.params;

		if (!token) {
			return {
				code: 400,
				message: "Token is required",
				error: "Missing token",
			};
		}

		// Find recipient with valid token and active status
		const recipientDetails =
			await this.settings.models.pdfFormRecipients.findOne({
				where: {
					token,
					form_id: { [Op.ne]: null },
					// No need company_id, TenantId is required
					[Op.and]: [
						{ status: { [Op.ne]: "revoked" } },
						{
							[Op.or]: [
								{ status: "mailed" },
								{ status: "viewed" },
								{ status: "completed" },
							],
						},
					],
				},
				attributes: ["id", "company_id", "form_id"],
			});

		// Handle invalid or revoked tokens
		if (!recipientDetails) {
			return {
				code: 400,
				message: "Form has been revoked by the sender",
				error: "Invalid token",
			};
		}

		if (recipientDetails?.status === "completed") {
			return {
				code: 400,
				message: "This Document has been signed already",
			};
		}

		// For direct API token validation checks
		if (directCheck) {
			return {
				code: 200,
				message: "Token validated successfully",
				data: recipientDetails,
			};
		}

		// For middleware use - set company context and continue
		// ctx.params.company_id = recipientDetails.company_id;
		// ctx.params.is_public = true;
		return {
			code: 200,
			company_id: recipientDetails.company_id,
			is_public: true,
		};
	} catch (error) {
		console.error("Error verifying PDF token:", error);
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
			error: error.message,
		};
	}
}

// Helper functions
async function handleFileDetails(
	mode,
	contentType,
	formData,
	companyId,
	ctx,
	previousContentId,
	selfSigned = false
	// t
) {
	let fileDetails = {};
	if (["create", "duplicate"].includes(mode) && contentType === "template") {
		fileDetails = await this.settings.models.pdfFormFiles.create(
			{
				file_name:
					mode === "edit" ? formData?.title : formData.file_name,
				file_url: formData.file_url,
				key: formData.key,
				company_id: companyId,
				created_by: ctx?.meta?.user?.id,
				size: formData?.size,
			}
			// {
			// 	transaction: t,
			// }
		);
		fileDetails.form_original_key = formData.key;
		fileDetails.form_original_url = formData.file_url;
	} else if (
		["create", "duplicate"].includes(mode) &&
		contentType === "form"
	) {
		fileDetails = {
			file_name: formData.file_name,
			file_url: formData.file_url,
			key: formData.key,
			form_original_url: formData.file_url,
			form_original_key: formData.key,
			size: formData?.size,
		};
	} else if (
		["edit", "initiate"].includes(mode) &&
		contentType === "template"
	) {
		const previousData = await this.settings.models.pdfForms.findOne({
			where: {
				id: previousContentId,
				is_template: true,
				company_id: companyId,
			},
			attributes: [
				"form_url",
				"key",
				"title",
				"file_id",
				"id",
				"size",
				"form_original_key",
				"form_original_url",
			],
		});
		if (mode === "initiate" && !selfSigned) {
			const newFile = await this.copyObject(
				{
					file_url: previousData?.form_url,
					key: previousData?.key,
					file_name: previousData?.title,
				},
				"SLICE HRMS/images/signify/forms/"
			);
			fileDetails = {
				file_name: previousData?.title,
				file_url: newFile.fileUrl,
				key: newFile.key,
				form_original_key: newFile.key,
				form_original_url: newFile.fileUrl,
				file_id: formData?.file_id || previousData.file_id,
				size: previousData?.size,
			};
		} else {
			fileDetails = previousData?.dataValues;
		}
		if (mode === "edit") {
			await this.settings.models.pdfFormFiles.update(
				{
					file_name: formData.title,
					file_url: formData?.file_url,
					key: formData?.key,
				},
				{
					where: {
						id: fileDetails?.file_id || formData?.file_id,
						company_id: companyId,
					},
					// transaction: t,
				}
			);
			const recipients =
				await this.settings.models.pdfFormRecipients.findAll({
					where: {
						form_id: previousContentId,
						company_id: companyId,
					},
					attributes: ["id", "company_id"],
				});
			const recipientIds = recipients.map((r) => r?.id);
			await this.settings.models.pdfFormRecipients.destroy({
				where: { id: recipientIds, company_id: companyId },
				// transaction: t,
			});
			console.log("DESTROYED FROM TEMPLATE");
		}
	}
	return fileDetails;
}

// async function handleEditForm(
// 	fileDetails,
// 	oldFormData,
// 	previousContentId,
// 	companyId,
// 	recipientsDetails, // payload Recipients
// 	title,
// 	ctx,
// 	emailSubject,
// 	emailTemplate,
// 	companyData,
// 	randomUUID
// 	// t
// ) {
// 	if (fileDetails?.form_original_key && fileDetails?.key) {
// 		await this.bulkDeleteFromS3([
// 			oldFormData?.key,
// 			oldFormData?.form_original_key,
// 		]);
// 	}

// 	// for draft form we will delete all users and insert new payload

// 	if (oldFormData?.status === "draft") {
// 		await this.settings.models.pdfFormRecipients.destroy({
// 			where: {
// 				form_id: previousContentId,
// 				company_id: companyId,
// 			},
// 			// transaction: t,
// 		});
// 	}

// 	// ------------------------------------------------------Removed User Start------------------------------------------------------
// 	// remaining recipients [mailed ,viewed,pending]
// 	let remainingRecipient =
// 		await this.settings.models.pdfFormRecipients.findAll({
// 			where: {
// 				form_id: previousContentId,
// 				company_id: companyId,
// 				[Op.and]: [
// 					{ status: { [Op.ne]: "revoked" } },
// 					{
// 						[Op.or]: [
// 							{ status: "mailed" },
// 							{ status: "viewed" },
// 							{ status: "pending" },
// 							{ status: "bounced" }, // bounced
// 						],
// 					},
// 				],
// 			},
// 			attributes: [
// 				"id",
// 				"company_id",
// 				"email",
// 				"token",
// 				"r_priority",
// 				"status",
// 				"name",
// 				"role",
// 			],
// 		});

// 	// recipient which have different id means newly added and removed recipients
// 	const differentRecipients = remainingRecipient.filter(
// 		(r) => !recipientsDetails.some((rd) => rd.id === r.id)
// 	);

// 	//-------------------
// 	// we find the same recipient which have same email id and Id with different role(in update)
// 	const sameRecipientsWithDifferentRole = remainingRecipient
// 		.map((r) => {
// 			const recipient = recipientsDetails.find((rd) => rd.id === r.id);
// 			return recipient && recipient.role !== r.role
// 				? { ...recipient, token: r.token }
// 				: null;
// 		})
// 		.filter(Boolean);

// 	console.log("sameRecipients", sameRecipientsWithDifferentRole);

// 	// we need to find those recipient which are already available in table so find them using token
// 	const deleteObjs = differentRecipients.filter(
// 		(recipient) => recipient?.dataValues && "token" in recipient.dataValues
// 	);

// 	// Newly added recipients which will get new id/
// 	let recipientDataArray = [];
// 	const newRecipient = recipientsDetails
// 		?.filter(
// 			(recipient) =>
// 				!("status" in recipient) &&
// 				!remainingRecipient.some((data) => data.id === recipient.id)
// 		)
// 		?.map((recipient) => ({
// 			...recipient,
// 			isNew: true,
// 		}));

// 	// if (newRecipient.length > 0) {
// 	const preparedData = await prepareRecipientData.call(
// 		this,
// 		newRecipient,
// 		oldFormData?.dataValues?.is_priority_required,
// 		oldFormData?.dataValues?.status === "draft",
// 		oldFormData?.id,
// 		companyId,
// 		"edit",
// 		"form"
// 	);
// 	await this.settings.models.pdfFormRecipients.bulkCreate(preparedData);

// 	recipientDataArray = preparedData?.map((r) => ({
// 		...r,
// 		isAdded: true,
// 	}));

// 	// 	remainingRecipient = remainingRecipient?.concat(recipientDataArray);
// 	// }

// 	//------------------------------------------------------ Edit User (name,email,role,r_priority) Start------------------------------------------------------

// 	// we need to find changed recipient whose id will same but email and named are different
// 	const changedRecipientsData = await Promise.all(
// 		recipientsDetails.map(async (recipient) => {
// 			//matching the id of recipients and check there role is same
// 			const matchingRecipient = remainingRecipient.find(
// 				(r) =>
// 					r?.id === recipient?.id && //
// 					!sameRecipientsWithDifferentRole.some(
// 						(sr) => sr.id === r.id
// 					)
// 			);

// 			// const matchingRecipient = remainingRecipient.find(
// 			// 	(r) =>
// 			// 		r?.id === recipient?.id
// 			// );

// 			if (
// 				matchingRecipient && // id is there and its not draft and status is viewed mailed and pending
// 				oldFormData?.dataValues?.status !== "draft" &&
// 				["viewed", "mailed", "pending", "bounced"].includes(
// 					matchingRecipient?.status
// 				)
// 			) {
// 				if (
// 					matchingRecipient?.email !== recipient?.email ||
// 					matchingRecipient?.name !== recipient?.name ||
// 					matchingRecipient?.role !== recipient?.role ||
// 					matchingRecipient?.r_priority !== recipient?.r_priority
// 				) {
// 					// recipient.isPriorityChanged =
// 					// 	matchingRecipient?.r_priority !== recipient?.r_priority;
// 					recipient.isChanged = true;
// 					recipient.oldEmail = matchingRecipient?.email;
// 					recipient.oldName = matchingRecipient?.name;
// 					recipient.oldToken = matchingRecipient?.token;
// 					recipient.oldStatus = matchingRecipient?.status;
// 					return recipient;
// 				}

// 				return null;
// 			}
// 		historyArr.push({
// 			activity: `Document has been sent to  ${recipient?.dataValues?.name}`,
// 			action: "mailed",
// 			form_id: previousContentId,
// 			company_id: companyId,
// 			performer_name: "System",
// 		});

// 		const mailData = await getEmailTemplateAndSendMail.call(
// 			this,
// 			previousContentId,
// 			{
// 				name: recipient?.dataValues?.name,
// 				email: recipient?.dataValues?.email,
// 				token: recipient?.dataValues?.token,
// 				role: recipient?.dataValues?.role,
// 			},
// 			{
// 				title: title || fileDetails?.file_name,
// 				user: {
// 					full_name: ctx.meta?.user?.full_name,
// 				},
// 				company: {
// 					name: oldFormData?.dataValues?.company
// 						?.name,
// 					id: oldFormData?.dataValues?.company?.id,
// 				},
// 			},
// 			"document_viewer",
// 			false
// 		);
// 		return mailData;
// 	})
// ));

// 			return null;
// 		})
// 	);
// 	const changedRecipients = changedRecipientsData?.filter(Boolean);

// 	// Filter out changed recipients who are not bounced, have changes, and are not pending.
// 	const removedEmailToChangedRecipients = changedRecipients.filter(
// 		(r) =>
// 			r?.oldStatus !== "bounced" && r?.isChanged && r.status !== "pending"
// 	);

// 	// we sending email to changed recipients which are revoked
// 	const changedRecipientOldEmailData = await Promise.all(
// 		removedEmailToChangedRecipients.map((r) => {
// 			const emailData = getEmailTemplateAndSendMail.call(
// 				this,
// 				previousContentId,
// 				{
// 					name: r?.oldName,
// 					email: r?.oldEmail,
// 				},
// 				{
// 					title: title || fileDetails?.file_name,
// 					user: {
// 						full_name: ctx.meta?.user?.full_name,
// 						email: ctx.meta?.user?.email,
// 					},
// 					company: {
// 						name: oldFormData?.dataValues?.company?.name,
// 						id: oldFormData?.dataValues?.company?.id,
// 					},
// 				},
// 				"recipient_removed"
// 			);
// 			return emailData;
// 		})
// 	);

// 	const changedRecipientOldEmailArr = changedRecipientOldEmailData?.filter(
// 		(r) => r !== null || r !== undefined
// 	);

// 	// console.log(
// 	// 	"**************** we send email to changed recipients (revoked user) ***********************",
// 	// 	changedRecipientOldEmailArr
// 	// );
// 	if (changedRecipientOldEmailArr?.length > 0) {
// 		this.broker.call("sesEmail.sendSliceSealForm", {
// 			mailArr: changedRecipientOldEmailArr,
// 			// trackEvent: true,
// 		});
// 	}

// 	// we are sending the email to the newly update recipients who has mailed or viewed or bounced status and update the data for pending users
// 	if (changedRecipients?.length > 0) {
// 		await addSignId.call(this, changedRecipients, companyId, randomUUID);
// 			await this.settings.models.pdfFormRecipients.update(
// 				{
// 					status: isSuppressed ? "bounced" : "mailed",
// 				},
// 				{
// 					where: {
// 						company_id: companyId,
// 						form_id: oldFormData?.id,
// 						id: pendingRecipient?.id,
// 					},
// 					// transaction: t,
// 				}
// 			);
// 		}
// 		// send the email to the new signer

// 		const emailData =
// 			pendingRecipient &&
// 			(await getEmailTemplateAndSendMail.call(
// 				this,
// 				previousContentId,
// 				{
// 					name: pendingRecipient?.dataValues?.name,
// 					email: pendingRecipient?.dataValues?.email,
// 					token: pendingRecipient?.dataValues?.token,
// 					role: pendingRecipient?.dataValues?.role,
// 				},
// 				{
// 					title: title || fileDetails?.file_name,
// 					user: {
// 						full_name: ctx.meta?.user?.full_name,
// 					},
// 					company: {
// 						name: oldFormData?.dataValues?.company?.name,
// 						id: oldFormData?.dataValues?.company?.id,
// 					},
// 				},
// 				"document_sign_request",
// 				false,
// 				emailSubject,
// 				emailTemplate
// 			));

// 		pendingRecipient &&
// 			historyArr.push({
// 				activity: `Document has been sent to  ${pendingRecipient?.dataValues?.name}`,
// 				action: "mailed",
// 				form_id: previousContentId,
// 				company_id: companyId,
// 				performer_name: "System",
// 			});

// 		if (emailData) {
// 			this.broker.call("sesEmail.sendSliceSealForm", {
// 				mailArr: [emailData],
// 				trackEvent: true,
// 			});
// 		}
// 	}
// }

// 		const updatedRecipientData = oldFormData?.is_priority_required
// 			? updatedStatusBasedOnPriority(changedRecipients, recipientsDetails)
// 			: changedRecipients;

// 		const newEmailToChangedRecipients = await Promise.all(
// 			updatedRecipientData?.map(async (recipient) => {
// 				const token = crypto.randomBytes(6).toString("hex");

// 				//Check if the email is suppressed(In invalid email list) list or not
// 				const isSuppressed =
// 					recipient &&
// 					(await this.isEmailSuppressed(recipient?.email));

// 				recipient.status = isSuppressed ? "bounced" : recipient?.status;

// 				// if user is replaced at 2 or 3 r_priority then we only update the data because we don't send email to them cause their priority is higher
// 				if (recipient.status === "pending") {
// 					await this.settings.models.pdfFormRecipients.update(
// 						{
// 							name: recipient?.name,
// 							email: recipient?.email,
// 							role: recipient?.role,
// 							token,
// 							color: recipient?.color,
// 							type: recipient?.type,
// 							status: isSuppressed ? "bounced" : recipient.status,
// 							r_priority: recipient?.r_priority,
// 							user_id:
// 								recipient?.type === "inside_organization"
// 									? recipient?.user_id
// 									: null,
// 						},
// 						{
// 							where: {
// 								company_id: companyId,
// 								id: recipient?.id,
// 							},
// 							// transaction: t,
// 						}
// 					);
// 				} else {
// 					// added the new row in the form recipient table for the revoked user
// 					if (
// 						recipient?.isChanged
// 						// ||!oldFormData?.dataValues?.is_priority_required
// 					) {
// 						// if user name is change or email is change we need to add old user entry in revoked table
// 						await this.settings.models.pdfFormRevokedUsers.create(
// 							{
// 								company_id: companyId,
// 								form_id: previousContentId,
// 								name: recipient?.oldName,
// 								email: recipient?.oldEmail,
// 								token: recipient?.oldToken,
// 							}
// 							// {
// 							// 	transaction: t,
// 							// }
// 						);
// 					}

// 					// we update the new user data in the form recipient table
// 					await this.settings.models.pdfFormRecipients.update(
// 						{
// 							name: recipient?.name,
// 							email: recipient?.email,
// 							token:
// 								recipient?.isChanged ||
// 								!oldFormData?.dataValues?.is_priority_required
// 									? token
// 									: recipient?.oldToken,
// 							form_id: recipient?.form_id || oldFormData?.id,
// 							company_id: companyId,
// 							color: recipient?.color,
// 							type: recipient?.type,
// 							status: isSuppressed
// 								? "bounced"
// 								: recipient?.status,
// 							// recipient?.status === "bounced"
// 							// 	? "mailed"
// 							// 	: recipient?.status,
// 							// r_priority: oldFormData?.dataValues
// 							// 	?.is_priority_required
// 							// 	? recipient?.r_priority
// 							// 	: 0,
// 							r_priority: recipient?.r_priority,
// 							role: recipient?.role,
// 							user_id:
// 								recipient?.type === "inside_organization"
// 									? recipient?.user_id
// 									: null,
// 						},
// 						{
// 							where: {
// 								company_id: companyId,
// 								id: recipient?.id, // revoked the old email based row
// 							},
// 							// transaction: t,
// 						}
// 					);
// 				}

// 				console.log("Updated recipient:", recipient);
// 				// only send mail to viewed and mailed recipients
// 				if (
// 					recipient?.status !== "pending" &&
// 					recipient?.isChanged &&
// 					isSuppressed === false
// 					// (recipient?.isChanged ||
// 					//\ 	!oldFormData?.dataValues?.is_priority_required)
// 				) {
// 					const emailData = getEmailTemplateAndSendMail.call(
// 						this,
// 						previousContentId,
// 						{
// 							name: recipient?.name,
// 							email: recipient?.email,
// 							token,
// 							role: recipient?.role,
// 						},
// 						{
// 							title: title || fileDetails?.file_name,
// 							user: {
// 								full_name: ctx.meta?.user?.full_name,
// 							},
// 							company: {
// 								name:
// 									ctx.meta?.user?.company?.name ||
// 									oldFormData?.dataValues?.company?.name,
// 								id:
// 									ctx.meta?.user?.company?.id ||
// 									oldFormData?.dataValues?.company?.id,
// 							},
// 						},
// 						recipient?.role === "signer"
// 							? "document_sign_request"
// 							: "document_viewer",
// 						false,
// 						emailSubject,
// 						emailTemplate
// 					);

// 					return emailData;
// 				}
// 			})
// 		);

// 		const recipientChangeArr = newEmailToChangedRecipients?.filter(Boolean);

// 		// Need to check if any user have mailed status and it's previous records those have viewer role

// 		// const sortedRecipientsArr = recipientChangeArr?.sort(
// 		// 	(a, b) => a.r_priority - b.r_priority
// 		// );

// 		// Find the index of the first recipient with status "mailed"
// 		// const mailedIndex = sortedRecipientsArr?.findIndex(
// 		// 	(recipient) => recipient.status === "mailed"
// 		// );

// 		// Get the array part till the mailedStatusRecipients
// 		// const mailedStatusPreviousRecipients =
// 		// 	mailedIndex !== -1 ? sortedRecipientsArr.slice(0, mailedIndex) : [];

// 		// remove the  object which has completed status and signer

// 		// const filteredViewerRecipients = mailedStatusPreviousRecipients.filter(
// 		// 	(recipient) =>
// 		// 		recipient.status !== "completed" || recipient.role !== "signer"
// 		// );

// 		// if (filteredViewerRecipients?.length > 0) {
// 		// 	await Promise.all(
// 		// 		filteredViewerRecipients.map(async (recipient) => {
// 		// 			await this.settings.models.pdfFormRecipients.update(
// 		// 				{
// 		// 					status: "mailed",
// 		// 				},
// 		// 				{
// 		// 					where: {
// 		// 						company_id: companyId,
// 		// 						id: recipient?.id,
// 		// 					},
// 		// 				}
// 		// 			);
// 		// 		})
// 		// 	);
// only send mail to viewed and mailed recipients
// if (
// 	recipient?.status !== "pending" &&
// 	recipient?.isChanged &&
// 	isSuppressed === false
// 	// (recipient?.isChanged ||
// 	//\ 	!oldFormData?.dataValues?.is_priority_required)
// ) {
// 	historyArr.push({
// 		activity: `Document has been sent to  ${recipient?.name}`,
// 		action: "mailed",
// 		form_id: previousContentId,
// 		company_id: companyId,
// 		performer_name: "System",
// 	});
// 	const emailData = getEmailTemplateAndSendMail.call(
// 		this,
// 		previousContentId,
// 		{
// 			name: recipient?.name,
// 			email: recipient?.email,
// 			token,
// 			role: recipient?.role,
// 		},
// 		{
// 			title: title || fileDetails?.file_name,
// 			user: {
// 				full_name: ctx.meta?.user?.full_name,
// 			},
// 			company: {
// 				name:
// 					ctx.meta?.user?.company?.name ||
// 					oldFormData?.dataValues?.company?.name,
// 				id:
// 					ctx.meta?.user?.company?.id ||
// 					oldFormData?.dataValues?.company?.id,
// 			},
// 		},
// 		recipient?.role === "signer"
// 			? "document_sign_request"
// 			: "document_viewer",
// 		false,
// 		emailSubject,
// 		emailTemplate
// 	);

// 		// 	// send email to all  filtered recipients
// 		// 	const mailData = await Promise.all(
// 		// 		filteredViewerRecipients.map(async (recipient) => {
// 		// 			const emailData = getEmailTemplateAndSendMail.call(
// 		// 				this,
// 		// 				previousContentId,
// 		// 				{
// 		// 					name: recipient?.name,
// 		// 					email: recipient?.email,
// 		// 					token: recipient?.token,
// 		// 					role: recipient?.role,
// 		// 				},
// 		// 				{
// 		// 					title: title || fileDetails?.file_name,
// 		// 					user: {
// 		// 						full_name: ctx.meta?.user?.full_name,
// 		// 					},
// 		// 					company: {
// 		// 						name:
// 		// 							ctx.meta?.user?.company?.name ||
// 		// 							oldFormData?.dataValues?.company?.name,
// 		// 						id:
// 		// 							ctx.meta?.user?.company?.id ||
// 		// 							oldFormData?.dataValues?.company?.id,
// 		// 					},
// 		// 				},
// 		// 				recipient?.role === "signer"
// 		// 					? "document_sign_request"
// 		// 					: "document_viewer",
// 		// 				false,
// 		// 				emailSubject,
// 		// 				emailTemplate
// 		// 			);
// 		// 			return emailData;
// 		// 		})
// 		// 	);

// 		// 	const newMailData = mailData?.filter(Boolean);

// 		// 	if (newMailData?.length > 0) {
// 		// 		this.broker.call("sesEmail.sendSliceSealForm", {
// 		// 			mailArr: newMailData,
// 		// 			trackEvent: true,
// 		// 		});
// 		// 	}
// 		// }

// 		// console.log(
// 		// 	"**************** Send email to newly updated user ***********************",
// 		// 	recipientChangeArr
// 		// );
// 		// if (recipientChangeArr?.length > 0) {
// 		// 	this.broker.call("sesEmail.sendSliceSealForm", {
// 		// 		mailArr: recipientChangeArr,
// 		// 		trackEvent: true,
// 		// 	});
// 		// }
// 	}

// 	//------------------------------------------------------ Edit User (name,email,role,r_priority) End------------------------------------------------------

// 	// role changed user and deleted user
// 	const needToDeleteUsers = [
// 		...deleteObjs,
// 		...sameRecipientsWithDifferentRole,
// 		// ...changedPriorityRecipients,
// 	];

// 	// check if there are no duplicate object in needToDeleteUsers
// 	const uniqueNeedToDeleteUsers = needToDeleteUsers.filter(
// 		(value, index, self) =>
// 			index === self.findIndex((t) => t.id === value.id)
// 	);

// 	// we removed the user and sending the email to removed user and destroy the fields
// 	const removedUserData = await Promise.all(
// 		uniqueNeedToDeleteUsers?.map(async (r) => {
// 			// so we delete the old role user and create entry in Revoked user table
// 			await this.settings.models.pdfFormRecipients.destroy({
// 				where: { id: r?.id, company_id: companyId },
// 				// transaction: t,
// 			});
// 			await this.settings.models.pdfFormRevokedUsers.create(
// 				{
// 					company_id: companyId,
// 					form_id: previousContentId,
// 					name: r?.name,
// 					email: r?.email,
// 					token: r?.token,
// 				}
// 				// {
// 				// 	transaction: t,
// 				// }
// 			);
// 			// }
// 			// if (r?.status !== "pending" )
// 			if (["viewed", "mailed", "bounced"].includes(r?.status)) {
// 				const mailData = await getEmailTemplateAndSendMail.call(
// 					this,
// 					previousContentId,
// 					{
// 						name: r?.name,
// 						email: r?.email,
// 					},
// 					{
// 						title: title || fileDetails?.file_name,
// 						user: {
// 							full_name: ctx.meta?.user?.full_name,
// 							email: ctx.meta?.user?.email,
// 						},
// 						company: {
// 							name: oldFormData?.dataValues?.company?.name,
// 							id: oldFormData?.dataValues?.company?.id,
// 						},
// 					},
// 					"recipient_removed"
// 				);

// 				return mailData;
// 			}
// 		})
// 	);

// 	const removedUserArr = removedUserData?.filter(
// 		(r) => r != null || r != undefined
// 	);

// 	if (removedUserArr?.length > 0) {
// 		this.broker.call("sesEmail.sendSliceSealForm", {
// 			mailArr: removedUserArr,
// 		});
// 	}

// 	// ------------------------------------------------------Removed User End------------------------------------------------------

// 	// if flow is priority find the next signer of form and check its status if its pending then need Mailed the email
// 	// if (oldFormData?.is_priority_required && oldFormData?.status !== "draft") {
// 	// 	//check any signer is there with mailed status
// 	// 	let mailRecipient =
// 	// 		await this.settings.models.pdfFormRecipients.findOne({
// 	// 			where: {
// 	// 				role: "signer",
// 	// 				company_id: companyId,
// 	// 				// status: "mailed",
// 	// 				[Op.or]: [
// 	// 					{ status: "mailed" },
// 	// 					{ status: "viewed" },
// 	// 					{ status: "bounced" },
// 	// 				],
// 	// 				form_id: oldFormData?.id,
// 	// 			},
// 	// 			order: [["r_priority", "ASC"]],
// 	// 		});

// 	// 	if (!mailRecipient) {
// 	// 		// find all the pending recipients
// 	// 		const pendingRecipients =
// 	// 			await this.settings.models.pdfFormRecipients.findAll({
// 	// 				where: {
// 	// 					company_id: companyId,
// 	// 					status: "pending",
// 	// 					form_id: oldFormData?.id,
// 	// 				},
// 	// 				order: [["r_priority", "ASC"]],
// 	// 			});

// 	// 		// sortList based on r_priority
// 	// 		const { signer, viewer: viewerRecipients } =
// 	// 			identifySignerAndViewer(pendingRecipients);

// 	// 		// send email to all In between Recipients
// 	// 		const viewerMailData =
// 	// 			viewerRecipients?.length > 0 &&
// 	// 			(await Promise.all(
// 	// 				viewerRecipients.map(async (recipient) => {
// 	// 					const isSuppressed = recipient && await this.isEmailSuppressed(
// 	// 						recipient?.email
// 	// 					);

// 	// 					await this.settings.models.pdfFormRecipients.update(
// 	// 						{
// 	// 							status: isSuppressed ? "bounced" : "mailed",
// 	// 						},
// 	// 						{
// 	// 							where: {
// 	// 								company_id: companyId,
// 	// 								form_id: oldFormData?.id,
// 	// 								id: recipient?.id,
// 	// 							},
// 	// 							// transaction: t,
// 	// 						}
// 	// 					);

// 	// 					const mailData = await getEmailTemplateAndSendMail.call(
// 	// 						this,
// 	// 						previousContentId,
// 	// 						{
// 	// 							name: recipient?.dataValues?.name,
// 	// 							email: recipient?.dataValues?.email,
// 	// 							token: recipient?.dataValues?.token,
// 	// 							role: recipient?.dataValues?.role,
// 	// 						},
// 	// 						{
// 	// 							title: title || fileDetails?.file_name,
// 	// 							user: {
// 	// 								full_name: ctx.meta?.user?.full_name,
// 	// 							},
// 	// 							company: {
// 	// 								name: oldFormData?.dataValues?.company
// 	// 									?.name,
// 	// 								id: oldFormData?.dataValues?.company?.id,
// 	// 							},
// 	// 						},
// 	// 						"document_viewer",
// 	// 						false
// 	// 					);
// 	// 					return mailData;
// 	// 				})
// 	// 			));

// 	// 		const mailData =
// 	// 			viewerMailData.length > 0 &&
// 	// 			viewerMailData?.filter((v) => v !== undefined || v !== null);

// 	// 		if (mailData) {
// 	// 			this.broker.call("sesEmail.sendSliceSealForm", {
// 	// 				mailArr: mailData,
// 	// 				trackEvent: true,
// 	// 			});
// 	// 		}

// 	// 		const pendingRecipient = signer[0];

// 	// 		if (pendingRecipient) {
// 	// 			const isSuppressed = await this.isEmailSuppressed(
// 	// 				pendingRecipient?.email
// 	// 			);

// 	// 			await this.settings.models.pdfFormRecipients.update(
// 	// 				{
// 	// 					status: isSuppressed ? "bounced" : "mailed",
// 	// 				},
// 	// 				{
// 	// 					where: {
// 	// 						company_id: companyId,
// 	// 						form_id: oldFormData?.id,
// 	// 						id: pendingRecipient?.id,
// 	// 					},
// 	// 					// transaction: t,
// 	// 				}
// 	// 			);
// 	// 		}
// 	// 		// send the email to the new signer
// 	// 		const emailData =
// 	// 			pendingRecipient &&
// 	// 			(await getEmailTemplateAndSendMail.call(
// 	// 				this,
// 	// 				previousContentId,
// 	// 				{
// 	// 					name: pendingRecipient?.dataValues?.name,
// 	// 					email: pendingRecipient?.dataValues?.email,
// 	// 					token: pendingRecipient?.dataValues?.token,
// 	// 					role: pendingRecipient?.dataValues?.role,
// 	// 				},
// 	// 				{
// 	// 					title: title || fileDetails?.file_name,
// 	// 					user: {
// 	// 						full_name: ctx.meta?.user?.full_name,
// 	// 					},
// 	// 					company: {
// 	// 						name: oldFormData?.dataValues?.company?.name,
// 	// 						id: oldFormData?.dataValues?.company?.id,
// 	// 					},
// 	// 				},
// 	// 				"document_sign_request",
// 	// 				false,
// 	// 				emailSubject,
// 	// 				emailTemplate
// 	// 			));

// 	// 		if (emailData) {
// 	// 			this.broker.call("sesEmail.sendSliceSealForm", {
// 	// 				mailArr: [emailData],
// 	// 				trackEvent: true,
// 	// 			});
// 	// 		}
// 	// 	}
// 	// }

// 	//Added the isOld status for remaining recipients
// 	const pendingRecipients = recipientsDetails
// 		?.filter(
// 			(recipient) =>
// 				(recipient.status === "pending" ||
// 					recipient.status === "mailed" ||
// 					recipient.status === "viewed" ||
// 					recipient.status === "bounced") &&
// 				remainingRecipient.some((data) => data.id === recipient.id)
// 		)
// 		.filter(
// 			(r) => !sameRecipientsWithDifferentRole.some((sr) => sr.id === r.id)
// 		)
// 		// .filter(
// 		// 	r => !r.isAdded
// 		// )
// 		// .filter((r) => !changedPriorityRecipients.some((sr) => sr.id === r.id))
// 		.map((recipient) => ({
// 			...recipient,
// 			isOld: true,
// 			isDraftUser: oldFormData.status === "draft" ? true : false,
// 		}));

// 	// // Newly added recipients which will get new id/

// 	const newRecipientWithDifferentRole = sameRecipientsWithDifferentRole?.map(
// 		(r) => ({
// 			...r,
// 			isNew: true,
// 		})
// 	);

// 	// const newRecipientWithDifferentPriority = changedPriorityRecipients?.map(
// 	// 	(r) => ({
// 	// 		...r,
// 	// 		isNew: true,
// 	// 	})
// 	// );

// 	if (oldFormData?.status === "draft") {
// 		return {
// 			recipientsDetails: recipientsDetails.map((r) => ({
// 				...r,
// 				isNew: true,
// 			})),
// 			fileDetails: { file_name: title },
// 		};
// 	}
// 	return {
// 		recipientsDetails: [
// 			...pendingRecipients,
// 			...recipientDataArray,
// 			...newRecipientWithDifferentRole,
// 			// ...newRecipientWithDifferentPriority,
// 		],
// 		fileDetails: { file_name: title },
// 	};
// }
// 	if (oldFormData?.status === "draft") {
// 		return {
// 			recipientsDetails: recipientsDetails.map((r) => ({
// 				...r,
// 				isNew: true,
// 			})),
// 			fileDetails: { file_name: title },
// 		};
// 	}
// 	return {
// 		recipientsDetails: [
// 			...pendingRecipients,
// 			...newRecipient,
// 			...newRecipientWithDifferentRole,
// 		],
// 		fileDetails: { file_name: title },
// 		historyArr,
// 	};
// }

async function createOrUpdateFormData(
	mode,
	contentType,
	formData,
	fileDetails,
	title,
	isPriorityRequired,
	isDraft,
	previousContentId,
	companyId,
	randomUUID,
	ctx,
	formSettings,
	oldFormData,
	selfSigned
	// t
) {
	return mode === "edit" &&
		(contentType === "form" || contentType === "template")
		? await this.settings.models.pdfForms.update(
				{
					title: title || fileDetails?.file_name,
					expiration_date: formData?.expiration_date ?? null,
					reminder_days: formSettings?.data?.reminder_days,
					attach_audit_log: formData?.attach_audit_log,
					status: isDraft ? "draft" : "pending",
					form_original_url:
						contentType === "template" && formData?.file_url
							? formData?.file_url
							: fileDetails?.form_original_url,
					form_original_key:
						contentType === "template" && formData?.key
							? formData?.key
							: fileDetails?.form_original_key,
					form_url:
						contentType === "template" && formData?.file_url
							? formData?.file_url
							: fileDetails?.form_url,
					key:
						contentType === "template" && formData?.key
							? formData?.key
							: fileDetails?.key,
					note: formData?.note,
					...(contentType === "template" ||
					(contentType === "form" &&
						oldFormData?.dataValues?.status === "draft")
						? { is_priority_required: isPriorityRequired }
						: {}),
					// mailedAt: !isDraft ? formData?.mailedAt : null,
					mailedAt:
						oldFormData?.dataValues?.status === "draft" && !isDraft
							? new Date()
							: oldFormData?.dataValues?.mailedAt,
				},
				{
					where: {
						id: previousContentId,
						company_id: companyId,
					},
					// transaction: t,
				}
		  )
		: await this.settings.models.pdfForms.create(
				{
					is_priority_required: isPriorityRequired,
					file_id: fileDetails?.id || formData.file_id,
					document_id:
						mode === "create" && contentType === "template"
							? null
							: `DF-${randomUUID()}-${companyId}-${Date.now()}`,

					size: fileDetails?.size,
					created_by: ctx?.meta?.user?.id,
					status: isDraft
						? "draft"
						: selfSigned
						? "completed"
						: "pending",
					company_id: companyId,
					form_url: fileDetails?.file_url || fileDetails?.form_url,
					title: title || fileDetails?.file_name,
					key: fileDetails?.key,
					initiate: mode === "initiate",
					form_original_url: fileDetails?.form_original_url,
					form_original_key: fileDetails?.form_original_key,
					reminder_days: selfSigned
						? null
						: formSettings?.data?.reminder_days,
					expiration_date: formData?.expiration_date ?? null,
					is_template:
						["edit", "duplicate", "create"].includes(mode) &&
						contentType === "template",
					attach_audit_log: formData?.attach_audit_log,
					version: 1.0,
					note: formData?.note,
					email_template: formData?.email_template,
					email_subject: formData?.email_subject,
					form_token: crypto.randomBytes(6).toString("hex"), // form_token changes
					mailedAt: new Date(),
					self_signed: selfSigned || false,
				}
				// {
				// 	transaction: t,
				// }
		  );
}

async function prepareRecipientData(
	recipientsDetails,
	isPriorityRequired,
	isDraft,
	formId,
	companyId,
	mode,
	contentType
) {
	let recipientDataArray = recipientsDetails.map((recipient, index) => {
		if (recipient?.isOld === true) return;
		const token = crypto.randomBytes(6).toString("hex");

		return {
			user_id: recipient?.user_id || null,
			r_priority: recipient.r_priority, //
			type: recipient?.type,
			name: recipient?.name,
			email: recipient?.email,
			color: recipient?.color,
			role: recipient?.role,
			form_id: formId,
			company_id: companyId,
			token: token,
			status: recipient?.isNew
				? recipient?.status
					? recipient.status
					: "pending"
				: isDraft
				? "pending"
				: isPriorityRequired
				? "pending"
				: "mailed",
		};
	});

	recipientDataArray = recipientDataArray?.filter(Boolean);

	if (recipientDataArray.length > 0) {
		if (isPriorityRequired) {
			const isSuppressed = await this.isEmailSuppressed(
				recipientDataArray?.[0]?.email
			);

			if (isSuppressed) {
				recipientDataArray[0].status = "bounced";
			}
		} else {
			recipientDataArray = await Promise.all(
				recipientDataArray.map(async (recipient) => {
					const isSuppressed = await this.isEmailSuppressed(
						recipient?.email
					);
					if (isSuppressed) {
						return { ...recipient, status: "bounced" };
					} else {
						return recipient;
					}
				})
			);
		}
	}

	return recipientDataArray.filter((data) => data !== undefined);
}
async function handleEditFormFields(
	recipientsDetails,
	companyId,
	newRecipientData
	// t
) {
	const pendingRecipients = recipientsDetails.filter(
		(recipient) => recipient?.isOld
	);

	const signerRecipients = pendingRecipients
		.filter((recipient) => recipient?.role === "signer")
		?.sort((a, b) => a?.id - b?.id);

	for (const recipient of signerRecipients) {
		let isChanged = false;
		const oldFieldsData = await this.settings.models.pdfFormFields.findAll({
			where: {
				form_recipient_id: recipient.id,
				company_id: companyId,
			},
			include: [
				{
					model: this.settings.models.pdfFieldsOptions,
					attributes: ["id", "company_id", "label"],
				},
				{ model: this.settings.models.pdfFormRadioButtons },
			],
		});
		const newFieldsData = recipientsDetails?.find(
			(r) => recipient?.id === r?.id
		)?.fields;
		if (newFieldsData?.length !== oldFieldsData?.length) {
			isChanged = true;
			console.log("New Field Added *******************************");
		} else {
			for (let i = 0; i < newFieldsData?.length; i++) {
				[
					"uuid_field_id",
					"is_required",
					"x_coordinate",
					"y_coordinate",
					"zoom_x",
					"zoom_y",
					"scale_x",
					"scale_y",
					"pageIndex",
					"font_family",
					"field_label",
					"character_limit",
				].forEach((key) => {
					if (key === "x_coordinate" || key === "y_coordinate") {
						if (
							Math.round(newFieldsData[i]?.[key]) !==
							Math.round(oldFieldsData[i]?.[key])
						) {
							console.log(
								Math.round(newFieldsData[i]?.[key]),
								"new field *******************************",
								newFieldsData[i]?.[key],
								newFieldsData[i]
							);
							console.log(
								Math.round(oldFieldsData[i]?.[key]),
								"old field *******************************",
								oldFieldsData[i]?.[key],
								oldFieldsData[i]
							);

							isChanged = true;
							console.log(
								"Field changes *******************************"
							);
						}
					} else {
						if (
							newFieldsData[i]?.[key] !== oldFieldsData[i]?.[key]
						) {
							isChanged = true;
							console.log(
								"Field changes *******************************",
								newFieldsData[i]?.[key],
								oldFieldsData[i]?.[key]
							);
						}
					}
				});
				const oldOptions = oldFieldsData[i]?.pdf_fields_options;
				if (
					oldOptions?.length !== newFieldsData[i]?.options?.length &&
					oldOptions &&
					newFieldsData[i]?.options
				) {
					isChanged = true;
					console.log(
						"Option length changes *******************************"
					);
				} else {
					for (let j = 0; j < oldOptions?.length; j++) {
						if (
							oldOptions[j]?.label !==
							newFieldsData[i]?.options[j]?.label
						) {
							isChanged = true;
							console.log(
								"Field option changes *******************************"
							);
						}
					}
				}
				const oldRadioButtons =
					oldFieldsData[i]?.pdf_form_radio_buttons;
				if (
					oldRadioButtons?.length !==
						newFieldsData[i]?.radio_buttons?.length &&
					oldRadioButtons &&
					newFieldsData[i]?.radio_buttons
				) {
					isChanged = true;
				} else {
					for (let j = 0; j < oldRadioButtons?.length; j++) {
						[
							"uuid_field_id",
							"field_order",
							"x_coordinate",
							"y_coordinate",
							"field_label",
						].forEach((key) => {
							if (
								oldRadioButtons[j]?.[key] !==
								newFieldsData[i]?.radio_buttons[j]?.[key]
							) {
								isChanged = true;
							}
						});
					}
				}
			}
		}
		if (isChanged) {
			await this.settings.models.pdfFormRecipients.update(
				{ is_changed: recipient?.isDraftUser ? false : true },
				{
					where: { id: recipient.id, company_id: companyId },
					// transaction: t,
				}
			);
		}
	}
	await this.settings.models.pdfFormFields.destroy({
		where: {
			company_id: companyId,
			form_recipient_id: {
				[Op.in]: newRecipientData?.map((r) => r.id),
			},
		},
		// transaction: t,
	});
}

async function createFieldRecords(
	recipientsDetails,
	companyId,
	formId,
	mode,
	contentType,
	recipientData,
	newRecipientData
	// t
) {
	return await Promise.all(
		recipientsDetails?.map(async (recipient, index) => {
			const fieldsData = recipient?.fields?.map((field, order) => {
				if (field?.id) return null;
				return {
					...field,
					field_order: order,
					uuid_field_id: field?.uuid_field_id,
					company_id: companyId,
					form_id: formId,
					form_recipient_id:
						mode === "edit" && contentType === "form"
							? newRecipientData[index]?.id
							: recipientData[index]?.id,
				};
			});

			const filedArr = fieldsData?.filter(
				(field) => field !== undefined || field !== null
			);

			const fieldResponse =
				filedArr &&
				(await this.settings.models.pdfFormFields.bulkCreate(filedArr, {
					returning: true,
					// transaction: t,
				}));
			return fieldResponse
				?.map((record) => {
					return fieldsData
						?.map((field) => {
							if (
								record.dataValues.uuid_field_id ===
								field.uuid_field_id
							) {
								return {
									field_id: record.dataValues.id,
									options: field?.options || null,
									radioButtons: field?.radio_buttons,
								};
							}
						})
						?.filter((e) => e !== undefined);
				})
				?.filter((e) => e !== undefined);
		})
	);
}

async function createFieldOptionsAndRadioButtons(fieldRecords, companyId, t) {
	const radioGroups = fieldRecords
		.flat(Infinity)
		.map((field) => {
			return field?.radioButtons?.map((grp) => ({
				field_id: field?.field_id,
				...grp,
				company_id: companyId,
			}));
		})
		.filter((e) => e !== undefined)
		.flat(Infinity);

	const fieldOptions = fieldRecords
		.flat(Infinity)
		.map((field) => {
			return field?.options?.map((option) => ({
				field_id: field?.field_id,
				...option,
				company_id: companyId,
			}));
		})
		.filter((e) => e !== undefined)
		.flat(Infinity);

	if (fieldOptions.length > 0) {
		await this.settings.models.pdfFieldsOptions.bulkCreate(fieldOptions, {
			// transaction: t,
		});
	}

	if (radioGroups.length > 0) {
		await this.settings.models.pdfFormRadioButtons.bulkCreate(radioGroups, {
			// transaction: t,
		});
	}
}

async function sendEmailsToRecipients(
	formId,
	companyData,
	templateActions,
	isPriorityRequired,
	mode,
	contentType,
	recipientData,
	emailTemplate,
	emailSubject,
	tokenArray,
	ctx,
	title,
	oldFormData
	// t

	// fileDetails,
) {
	let isFormCompleted = false;
	const historyArr = [];

	if (isPriorityRequired) {
		if (
			!(
				mode === "edit" &&
				contentType === "form" &&
				oldFormData.status !== "draft"
			)
		) {
			if (!templateActions) {
				//do not use this
				// sorted the list based on the r priority
				const sortedList = recipientData.sort(
					(a, b) => a.r_priority - b.r_priority
				);
				const { signer, viewer: viewerRecipient } =
					identifySignerAndViewer(sortedList, mode);

				if (
					["duplicate", "create", "initiate"].includes(mode) ||
					oldFormData?.status === "draft"
				) {
					// send email to all viewers
					if (viewerRecipient?.length > 0) {
						const mailData = await Promise.all(
							viewerRecipient.map(async (recipient, index) => {
								const isSuppressed =
									recipient &&
									(await this.isEmailSuppressed(
										recipient?.email ||
											recipient?.dataValues?.email
									));

								await this.settings.models.pdfFormRecipients.update(
									{
										status: isSuppressed
											? "bounced"
											: "mailed",
									},
									{
										where: {
											id:
												recipient?.id ||
												recipient?.dataValues?.id,
											company_id:
												recipient?.company_id ||
												recipient?.dataValues
													?.company_id,
										},
										// transaction: t,
									}
								);

								await this.settings.models.pdfFormHistory.create(
									{
										activity: `Document has been sent to  ${
											recipient?.name ||
											recipient?.dataValues?.name
										}`,
										action: "mailed",
										form_id: formId,
										company_id: companyData?.data?.id,
										performer_name:
											ctx?.meta?.user?.full_name, // "System",
										performed_by: ctx?.meta?.user?.id,
									}
								);

								const emailData =
									await getEmailTemplateAndSendMail.call(
										this,
										formId,
										{
											name:
												recipient?.name ||
												recipient?.dataValues?.name,
											email:
												recipient?.email ||
												recipient?.dataValues?.email,
											token:
												recipient?.isDraftUser ||
												recipient?.dataValues
													?.isDraftUser
													? recipient?.token ||
													  recipient?.dataValues
															?.token
													: tokenArray[index],
											role:
												recipient?.role ||
												recipient?.dataValues?.role,
										},
										{
											title: title,
											user: {
												full_name:
													ctx.meta?.user?.full_name,
											},
											company: {
												name: companyData?.data?.name,
												id: companyData?.data?.id,
											},
										},
										"document_viewer",
										true, // isFirstRecipient
										emailSubject,
										emailTemplate
									);
								return emailData;
							})
						);

						// mailData.forEach((mail) =>
						// 	// this.sendEmail(mail)

						// );

						const mailArr = mailData?.filter(
							(r) => r !== undefined || r !== null
						);
						if (mailArr?.length > 0) {
							this.broker.call("sesEmail.sendSliceSealForm", {
								mailArr,
								trackEvent: true,
							});
						}
					}
					const isFirstRecipient = true;
					// send email to 1st signer recipient

					if (signer?.length > 0) {
						const isSuppressed =
							signer &&
							(await this.isEmailSuppressed(
								signer?.[0]?.email ||
									signer?.[0]?.dataValues?.email
							));

						await this.settings.models.pdfFormRecipients.update(
							{
								status: isSuppressed ? "bounced" : "mailed",
							},
							{
								where: {
									id:
										signer?.[0]?.id ||
										signer?.[0]?.dataValues?.id,
									company_id:
										signer?.[0]?.company_id ||
										signer?.[0]?.dataValues?.company_id,
								},
								// transaction: t,
							}
						);

						await this.settings.models.pdfFormHistory.create({
							activity: `Document has been sent to  ${
								signer?.[0]?.name ||
								signer?.[0]?.dataValues?.name
							}`,
							action: "mailed",
							form_id: formId,
							company_id: companyData?.data?.id,
							performer_name: ctx?.meta?.user?.full_name, // "System",
							performed_by: ctx?.meta?.user?.id,
						});

						const signerMailData =
							await getEmailTemplateAndSendMail.call(
								this,
								formId,
								{
									name:
										signer?.[0]?.name ||
										signer?.[0]?.dataValues?.name,
									email:
										signer?.[0]?.email ||
										signer?.[0]?.dataValues?.email,
									token:
										signer?.[0]?.token ||
										signer?.[0]?.dataValues?.token,
									role:
										signer?.[0]?.role ||
										signer?.[0]?.dataValues?.role,
								},
								{
									title: title,
									user: {
										full_name: ctx.meta?.user?.full_name,
									},
									company: {
										name: companyData?.data?.name,
										id: companyData?.data?.id,
									},
								},
								"document_sign_request",
								isFirstRecipient,
								emailSubject,
								emailTemplate
							);
						// for node mailer
						// this.sendEmail(signerMailData);
						if (signerMailData) {
							this.broker.call(
								"sesEmail.sendSliceSealForm",
								// signerMailData,
								{
									mailArr: [signerMailData],
									trackEvent: true,
								}
							);
						}
					}
				}
			}
		} else {
			//checked the newly added recipient
			if (
				recipientData?.length > 0 && // in recipientData we have all new recipients
				mode === "edit" &&
				contentType === "form"
			) {
				// find the mailed recipients from recipentData

				const mailedRecipients = recipientData.filter(
					(r) => r?.status === "mailed"
				);

				if (mailedRecipients?.length > 0) {
					// send the mail to the mailed recipients

					const recipientMailData = await Promise.all(
						mailedRecipients.map(async (recipient) => {
							const isSuppressed = await this.isEmailSuppressed(
								recipient?.email
							);

							historyArr.push({
								activity: `Document has been sent to  ${
									recipient?.dataValues?.name ||
									recipient?.name
								}`,
								action: "mailed",
								form_id: oldFormData?.id,
								company_id:
									oldFormData?.dataValues?.company?.id,
								performer_name: ctx?.meta?.user?.full_name,
								performed_by: ctx?.meta?.user?.id,
							});

							await this.settings.models.pdfFormRecipients.update(
								{
									status: isSuppressed ? "bounced" : "mailed",
								},
								{
									where: {
										id: recipient?.id,
									},
								}
							);

							const emailData =
								await getEmailTemplateAndSendMail.call(
									this,
									oldFormData?.id,
									{
										name:
											recipient?.dataValues?.name ||
											recipient?.name,
										email:
											recipient?.dataValues?.email ||
											recipient?.email,
										token:
											recipient?.dataValues?.token ||
											recipient?.token,
										role:
											recipient?.dataValues?.role ||
											recipient?.role,
									},
									{
										title: title,
										user: {
											full_name:
												ctx.meta?.user?.full_name,
										},
										company: {
											name: oldFormData?.dataValues
												?.company?.name,
											id: oldFormData?.dataValues?.company
												?.id,
										},
									},
									recipient?.role === "signer"
										? "document_sign_request"
										: "document_viewer",
									false
								);
							return emailData;
						})
					);

					// 		const mailData =
					// 			await getEmailTemplateAndSendMail.call(
					// 				this,
					// 				oldFormData?.id,
					// 				{
					// 					name: recipient?.dataValues?.name,
					// 					email: recipient?.dataValues?.email,
					// 					token: recipient?.dataValues?.token,
					// 					role: recipient?.dataValues?.role,
					// 				},
					// 				{
					// 					title: title,
					// 					user: {
					// 						full_name:
					// 							ctx.meta?.user?.full_name,
					// 					},
					// 					company: {
					// 						name: oldFormData?.dataValues
					// 							?.company?.name,
					// 						id: oldFormData?.dataValues
					// 							?.company?.id,
					// 					},
					// 				},
					// 				"document_viewer",
					// 				false
					// 			);
					// 		return mailData;
					// 	})
					// ));

					const mailData =
						recipientMailData?.length > 0 &&
						recipientMailData.filter(Boolean);

					if (mailData) {
						this.broker.call("sesEmail.sendSliceSealForm", {
							mailArr: mailData,
							trackEvent: true,
						});
					}

					// const pendingRecipient = signer[0];

					// // send emil to sender
					// if (pendingRecipient) {
					// 	const isSuppressed = await this.isEmailSuppressed(
					// 		pendingRecipient?.email
					// 	);

					// 	await this.settings.models.pdfFormRecipients.update(
					// 		{
					// 			status: isSuppressed ? "bounced" : "mailed",
					// 		},
					// 		{
					// 			where: {
					// 				company_id: companyData?.data?.id,
					// 				form_id: oldFormData?.id,
					// 				id: pendingRecipient?.id,
					// 			},
					// 			// transaction: t,
					// 		}
					// 	);
					// 	const emailData =
					// 		pendingRecipient &&
					// 		(await getEmailTemplateAndSendMail.call(
					// 			this,
					// 			oldFormData?.id,
					// 			{
					// 				name: pendingRecipient?.dataValues?.name,
					// 				email: pendingRecipient?.dataValues?.email,
					// 				token: pendingRecipient?.dataValues?.token,
					// 				role: pendingRecipient?.dataValues?.role,
					// 			},
					// 			{
					// 				title: title,
					// 				user: {
					// 					full_name: ctx.meta?.user?.full_name,
					// 				},
					// 				company: {
					// 					name: oldFormData?.dataValues?.company
					// 						?.name,
					// 					id: oldFormData?.dataValues?.company
					// 						?.id,
					// 				},
					// 			},
					// 			"document_sign_request",
					// 			false,
					// 			emailSubject,
					// 			emailTemplate
					// 		));

					// 	pendingRecipient &&
					// 		historyArr.push({
					// 			activity: `Document has been sent to  ${pendingRecipient?.dataValues?.name}`,
					// 			action: "mailed",
					// 			form_id: oldFormData?.id,
					// 			company_id:
					// 				oldFormData?.dataValues?.company?.id,
					// 			performer_name: "System",
					// 		});

					// 	// console.log(
					// 	// 	"**************** Added the new signer request send mail ***********************",
					// 	// 	emailData
					// 	// );
					// 	if (emailData) {
					// 		this.broker.call("sesEmail.sendSliceSealForm", {
					// 			mailArr: [emailData],
					// 			trackEvent: true,
					// 		});
					// 	}
					// } else {
					// 	// there is no signer it means only viewers are there
					// 	isFormCompleted = true;
					// }
				}
				// else {
				// 	// we need to find the first pending recipient
				// 	const pendingRecipients =
				// 		await this.settings.models.pdfFormRecipients.findAll({
				// 			where: {
				// 				company_id: companyData?.data?.id,
				// 				status: "pending",
				// 				form_id: oldFormData?.id,
				// 			},
				// 			order: [["r_priority", "ASC"]],
				// 		});

				// 	const { signer, viewer: viewerRecipients } =
				// 		identifySignerAndViewer(pendingRecipients);

				// 	// send email to all In between Recipients
				// 	const viewerMailData =
				// 		viewerRecipients?.length > 0 &&
				// 		(await Promise.all(
				// 			viewerRecipients.map(async (recipient) => {
				// 				const isSuppressed =
				// 					recipient &&
				// 					(await this.isEmailSuppressed(
				// 						recipient?.email
				// 					));

				// 				await this.settings.models.pdfFormRecipients.update(
				// 					{
				// 						status: isSuppressed
				// 							? "bounced"
				// 							: "mailed",
				// 					},
				// 					{
				// 						where: {
				// 							company_id: companyData?.data?.id,
				// 							form_id: oldFormData?.id,
				// 							id: recipient?.id,
				// 						},
				// 						// transaction: t,
				// 					}
				// 				);

				// 				const mailData =
				// 					await getEmailTemplateAndSendMail.call(
				// 						this,
				// 						oldFormData?.id,
				// 						{
				// 							name:
				// 								recipient?.dataValues?.name ||
				// 								recipient?.name,
				// 							email:
				// 								recipient?.dataValues?.email ||
				// 								recipient?.email,
				// 							token:
				// 								recipient?.dataValues?.token ||
				// 								recipient?.token,
				// 							role:
				// 								recipient?.dataValues?.role ||
				// 								recipient?.role,
				// 						},
				// 						{
				// 							title: title,
				// 							user: {
				// 								full_name:
				// 									ctx.meta?.user?.full_name,
				// 							},
				// 							company: {
				// 								name: oldFormData?.dataValues
				// 									?.company?.name,
				// 								id: oldFormData?.dataValues
				// 									?.company?.id,
				// 							},
				// 						},
				// 						"document_viewer",
				// 						false
				// 					);
				// 				return mailData;
				// 			})
				// 		));

				// 	const mailData =
				// 		viewerMailData?.length > 0 &&
				// 		viewerMailData?.filter(
				// 			(v) => v !== undefined || v !== null
				// 		);

				// 	if (mailData) {
				// 		this.broker.call("sesEmail.sendSliceSealForm", {
				// 			mailArr: mailData,
				// 			trackEvent: true,
				// 		});
				// 	}

				// 	const pendingRecipient = signer[0];

				// 	// send emil to sender
				// 	if (pendingRecipient) {
				// 		const isSuppressed = await this.isEmailSuppressed(
				// 			pendingRecipient?.email
				// 		);

				// 		await this.settings.models.pdfFormRecipients.update(
				// 			{
				// 				status: isSuppressed ? "bounced" : "mailed",
				// 			},
				// 			{
				// 				where: {
				// 					company_id: companyData?.data?.id,
				// 					form_id: oldFormData?.id,
				// 					id: pendingRecipient?.id,
				// 				},
				// 				// transaction: t,
				// 			}
				// 		);
				// 		const emailData =
				// 			pendingRecipient &&
				// 			(await getEmailTemplateAndSendMail.call(
				// 				this,
				// 				oldFormData?.id,
				// 				{
				// 					name:
				// 						pendingRecipient?.dataValues?.name ||
				// 						pendingRecipient?.name,
				// 					email:
				// 						pendingRecipient?.dataValues?.email ||
				// 						pendingRecipient?.email,
				// 					token:
				// 						pendingRecipient?.dataValues?.token ||
				// 						pendingRecipient?.token,
				// 					role:
				// 						pendingRecipient?.dataValues?.role ||
				// 						pendingRecipient?.role,
				// 				},
				// 				{
				// 					title: title,
				// 					user: {
				// 						full_name: ctx.meta?.user?.full_name,
				// 					},
				// 					company: {
				// 						name: oldFormData?.dataValues?.company
				// 							?.name,
				// 						id: oldFormData?.dataValues?.company
				// 							?.id,
				// 					},
				// 				},
				// 				"document_sign_request",
				// 				false,
				// 				emailSubject,
				// 				emailTemplate
				// 			));

				// 		// console.log(
				// 		// 	"**************** Added the new signer request send mail ***********************",
				// 		// 	emailData
				// 		// );
				// 		if (emailData) {
				// 			this.broker.call("sesEmail.sendSliceSealForm", {
				// 				mailArr: [emailData],
				// 				trackEvent: true,
				// 			});
				// 		}
				// 	} else {
				// 		// there is no signer it means only viewers are there
				// 		isFormCompleted = true;
				// 	}
				// }
			}
			if (
				recipientData?.find((r) => r?.role === "signer")?.length ===
					0 &&
				mode === "edit" &&
				contentType === "form"
			) {
				// it means no recipients are added
				isFormCompleted = true;
			}
		}
	} else {
		if (!templateActions) {
			// check if there any mailed Signer recipient

			if (mode == "edit" && contentType == "form") {
				const mailedSignedRecipient =
					await this.settings.models.pdfFormRecipients.findAll({
						where: {
							status: "mailed",
							role: "signer",
							company_id: companyData?.data?.id,
							form_id: oldFormData?.id,
						},
					});
				if (mailedSignedRecipient?.length === 0) {
					// It means send delete other mailed user and now only completed users are there
					// it means all left users are viewer and form is completed

					isFormCompleted = true;
				}
			}

			const mailData = await Promise.all(
				recipientData.map(async (recipient, index) => {
					if (!recipient?.isDraftUser) {
						if (recipient?.isOld === true) return;
					}

					const isSuppressed =
						recipient &&
						(await this.isEmailSuppressed(
							recipient?.email || recipient?.dataValues?.email
						));

					if (recipient?.isDraftUser) {
						await this.settings.models.pdfFormRecipients.update(
							{
								status: isSuppressed ? "bounced" : "mailed",
							},
							{
								where: {
									id:
										recipient?.id ||
										recipient?.dataValues?.id,
									company_id:
										recipient?.company_id ||
										recipient?.dataValues?.company_id,
								},
								// transaction: t,
							}
						);
					}

					const mailArr = [];

					// Need to check roles
					if (recipient?.role === "viewer") {
						historyArr.push({
							activity: `Document has been sent to  ${
								recipient?.name || recipient?.dataValues?.name
							}`,
							action: "mailed",
							form_id: formId,
							company_id: companyData?.data?.id,
							performer_name: ctx?.meta?.user?.full_name, // "System",
							performed_by: ctx?.meta?.user?.id,
						});
						const mailBody = await getEmailTemplateAndSendMail.call(
							this,
							formId,
							{
								name:
									recipient?.name ||
									recipient?.dataValues?.name,
								email:
									recipient?.email ||
									recipient?.dataValues?.email,
								token: recipient?.isDraftUser
									? recipient?.token ||
									  recipient?.dataValues?.token
									: tokenArray[index],
								role:
									recipient?.role ||
									recipient?.dataValues?.role,
							},
							{
								title: title,
								user: {
									full_name: ctx.meta?.user?.full_name,
								},
								company: {
									name: companyData?.data?.name,
									id: companyData?.data?.id,
								},
							},
							"document_viewer",
							!(mode === "edit" && contentType === "form") &&
								true, //isFirstRecipient
							emailSubject,
							emailTemplate
						);
						mailArr.push(mailBody);
					} else {
						historyArr.push({
							activity: `Document has been sent to  ${
								recipient?.name || recipient?.dataValues?.name
							}`,
							action: "mailed",
							form_id: formId,
							company_id: companyData?.data?.id,
							performer_name: ctx?.meta?.user?.full_name, // "System",
							performed_by: ctx?.meta?.user?.id,
						});
						const mailBody = await getEmailTemplateAndSendMail.call(
							this,
							formId,
							{
								name:
									recipient?.name ||
									recipient?.dataValues?.name,
								email:
									recipient?.email ||
									recipient?.dataValues?.email,
								token: recipient?.isDraftUser
									? recipient?.token ||
									  recipient?.dataValues?.token
									: tokenArray[index],
								role:
									recipient?.role ||
									recipient?.dataValues?.role,
							},
							{
								title: title,
								user: {
									full_name: ctx.meta?.user?.full_name,
								},
								company: {
									name: companyData?.data?.name,
									id: companyData?.data?.id,
								},
							},
							"document_sign_request",
							!(mode === "edit" && contentType === "form") &&
								true, // isFirst_recipient
							emailSubject,
							emailTemplate
						);
						mailArr.push(mailBody);
					}

					return mailArr;
				})
			);

			const emailData = mailData.flat();

			const emailArr = emailData?.filter(
				(r) => r !== null || r !== undefined
			);
			// console.log(
			// 	"**************** send email to all signer viewer (parallel flow) ***********************",
			// 	emailArr
			// );
			if (emailArr?.length > 0) {
				this.broker.call("sesEmail.sendSliceSealForm", {
					mailArr: emailArr,
					trackEvent: true,
				});
			}

			// for nodemailer
			// emailData.forEach((mail) => this.sendEmail(mail));
		}
	}
	if (isFormCompleted) {
		// send email to all recipients
		const signerUsers =
			await this.settings.models.pdfFormRecipients.findAll({
				where: {
					form_id: formId,
					company_id: ctx?.meta?.user?.company_id,
					role: "signer",
					status: { [Op.ne]: "revoked" },
				},
				include: [
					{
						model: this.settings.models.pdfFormFields,
						attributes: ["id", "status", "type"],
					},
				],
			});

		const isAllCompletedForm = signerUsers?.every(
			(r) => r?.dataValues?.status === "completed"
		);

		// As per logic we apply sign on last user so we find the last user data
		const lastSignerData = signerUsers?.at(-1);

		const isSignatureRequired = signerUsers?.some((r) =>
			r?.dataValues?.pdf_form_fields?.some(
				(f) =>
					f?.type === "signature" || f?.type === "digital signature"
			)
		);

		if (isAllCompletedForm) {
			// send email to all recipients

			await this.settings.models.pdfForms.update(
				{
					status: "completed",
				},
				{
					where: {
						id: oldFormData?.id,
						company_id: companyData?.data?.id,
					},
					// transaction: t,
				}
			);
			const dir = "signify/forms";
			const localPath = "./assets/";
			let combinedFilePath = null;
			let formUrl = oldFormData?.form;
			let combinedFileURL = null;

			const response = await addAuditLog.call(
				this,
				{
					full_name: oldFormData?.dataValues?.user?.full_name,
					email: oldFormData?.dataValues?.user?.email,
				},
				oldFormData?.form_url,
				oldFormData?.is_priority_required,
				oldFormData,
				companyData,
				dir,
				localPath,
				isSignatureRequired,
				null,
				true
				// t
			);

			if (isSignatureRequired) {
				combinedFilePath = response?.combinedFilePath;
			} else {
				formUrl = response?.url ? response?.url : formUrl;
				combinedFileURL = response?.combinedFileUrl;
			}

			if (isSignatureRequired) {
				const signedResponse =
					!oldFormData?.attach_audit_log &&
					(await applySign.call(
						this,
						formUrl,
						oldFormData,
						lastSignerData,
						companyData,
						dir,
						oldFormData?.is_priority_required
					));

				// apply signature on combined file
				const combinedFileURLResponse =
					isSignatureRequired && combinedFilePath
						? await applySign.call(
								this,
								combinedFilePath,
								oldFormData,
								lastSignerData,
								companyData,
								dir
						  )
						: null;

				formUrl = isSignatureRequired ? signedResponse?.url : formUrl;

				if (isSignatureRequired && oldFormData?.attach_audit_log) {
					formUrl = combinedFileURLResponse?.url;
				}

				if (combinedFileURL) {
					await this.settings.models.pdfForms.update(
						{
							form_url: formUrl,
							combined_file_url: combinedFileURLResponse?.url,
						},
						{
							where: {
								id: oldFormData?.id,
								company_id: companyData?.data?.id,
							},
							// transaction: t,
						}
					);
				}
				// else {
				// await this.settings.models.pdfForms.update(
				// 	{
				// 		form_url: formUrl,
				// 	},
				// 	{
				// 		where: {
				// 			id: oldFormData?.id,
				// 			company_id: companyData?.data?.id,
				// 		},
				// 	}
				// );
				// }
			}

			await this.settings.models.pdfForms.update(
				{
					form_url: formUrl,
				},
				{
					where: {
						id: oldFormData?.id,
						company_id: companyData?.data?.id,
					},
					// transaction: t,
				}
			);

			const allRecipients =
				await this.settings.models.pdfFormRecipients.findAll({
					where: {
						form_id: formId,
						company_id: ctx?.meta?.user?.company_id,
						status: { [Op.ne]: "revoked" },
					},
				});

			const mailPayload = await Promise.all(
				allRecipients?.map(async (recipient) => {
					const response = await getEmailTemplateAndSendMail.call(
						this,
						formId,
						{
							name: recipient.name,
							email: recipient.email,
						},
						{
							title: title,
							token: oldFormData?.form_token, // form token changes
							// formUrl,
							user: {
								full_name:
									oldFormData?.dataValues?.user?.full_name,
							},
							company: {
								name: companyData?.data?.name,
								id: companyData?.data?.id,
							},
						},
						"document_signed_by_all_recipients"
					);
					return response;
				})
			);

			const mailData = mailPayload?.filter(
				(r) => r !== null || r !== undefined
			);

			if (mailData) {
				this.broker.call("sesEmail.sendSliceSealForm", {
					mailArr: mailData,
				});
			}

			// Added the history
			await this.settings.models.pdfFormHistory.create(
				{
					activity: "Document has been Completed",
					action: "completed",
					form_id: formId,
					company_id: companyData?.data?.id,
					performer_name: "System",
				}
				// {
				// 	transaction: t,
				// }
			);

			// send email to sender

			const mailResponse = await getEmailTemplateAndSendMail.call(
				this,
				formId,
				{
					name: oldFormData?.dataValues?.user?.full_name,
					email: oldFormData?.dataValues?.user?.email,
				},
				{
					title: title,
					token: oldFormData?.form_token, // form token changes
					// formUrl,
					user: {
						full_name: oldFormData?.dataValues?.user?.full_name,
					},
					company: {
						name: companyData?.data?.name,
						id: companyData?.data?.id,
					},
				},
				"document_signed_by_all_recipients"
			);

			if (mailResponse) {
				this.broker.call("sesEmail.sendSliceSealForm", {
					mailArr: [mailResponse],
				});
			}
		}
	}
	return historyArr;
}

async function createFormHistory(
	mode,
	isDraft,
	templateActions,
	oldFormData,
	contentType,
	formId,
	companyId,
	ctx
	// t
) {
	const parser = new UAParser();
	parser.setUA(ctx.meta.userAgent);
	const browserDetails = parser.getResult();
	const { browser: browserInfo, os } = browserDetails;
	const ip = ctx?.meta?.ip;
	const browser = `${browserInfo?.name} ${os?.name}`;

	if (oldFormData?.dataValues?.status === "draft") {
		return;
	}

	let activityMessage = `Document has been ${isDraft ? "Drafted" : "Sent"}`;
	let activityStatus = isDraft ? "drafted" : "mailed";
	let performed_by =
		isDraft || mode === "edit" || mode === "initiate" || mode === "create"
			? ctx?.meta?.user?.id
			: null;
	let performerName =
		!isDraft && mode !== "edit" ? ctx?.meta?.user?.full_name : null;

	if (mode === "initiate") {
		performerName = null;
	}

	if (templateActions) {
		activityMessage = `Document has been ${
			mode === "edit" ? "Corrected" : "Created"
		}`;
		activityStatus = mode === "edit" ? "corrected" : "mailed";
		performed_by = ctx?.meta?.user?.id;
		performerName = null;
	}

	if (
		mode === "edit" &&
		oldFormData?.dataValues?.status !== "draft" &&
		contentType == "form"
	) {
		activityStatus = "corrected";
		activityMessage = "Document has been Corrected";
		performerName = ctx?.meta?.user?.full_name;
		performed_by = ctx?.meta?.user?.id;
		ip;
		browser;
	}

	const historyData = {
		activity: activityMessage,
		action: activityStatus,
		form_id: formId,
		company_id: companyId,
		performer_name: performerName,
		performed_by,
	};

	if (ip && browser) {
		historyData.ip = ip;
		historyData.browser = browser;
	}

	await this.settings.models.pdfFormHistory.create(historyData, {
		// transaction: t,
	});
}

async function createOrUpdateTags(tags, formId, mode, companyId, t) {
	if (mode === "edit") {
		const previousTags = await this.settings.models.pdfFormTags.findAll({
			where: {
				pdf_form_id: formId,
			},
			attributes: ["id", "pdf_tag_id"],
		});

		const previousTagIds = previousTags.map((tag) => tag.pdf_tag_id);
		const newTagIds = tags || [];

		// Determine tags to delete and tags to add
		const tagsToDelete = previousTagIds.filter(
			(tag) => !newTagIds.includes(tag)
		);
		const tagsToAdd = newTagIds.filter(
			(tag) => !previousTagIds.includes(tag)
		);

		// Delete tags that are no longer present
		if (tagsToDelete.length > 0) {
			await this.settings.models.pdfFormTags.destroy({
				where: {
					pdf_form_id: formId,
					pdf_tag_id: tagsToDelete,
				},
				// transaction: t,
			});
		}

		// Add new tags
		if (tagsToAdd.length > 0) {
			const tagData = tagsToAdd.map((tag) => ({
				company_id: companyId,
				pdf_tag_id: tag,
				pdf_form_id: formId,
			}));

			await this.settings.models.pdfFormTags.bulkCreate(tagData, {
				// transaction: t,
			});
		}
	} else {
		if (tags?.length > 0) {
			const tagData = tags.map((tag) => ({
				company_id: companyId,
				pdf_tag_id: tag,
				pdf_form_id: formId,
			}));

			await this.settings.models.pdfFormTags.bulkCreate(tagData, {
				// transaction: t,
			});
		}
	}
}

//Get the all users fields
async function getUserFields(ctx) {
	try {
		const userToken = ctx.params.token;

		const userFields = await this.settings.models.pdfFormRecipients.findOne(
			{
				where: {
					token: userToken,
					status: { [Op.ne]: "revoked" },
					// No need company_id, TenantId is required
				},
				include: [
					{
						model: this.settings.models.pdfForms,

						include: [
							{
								model: this.settings.models.pdfFormFiles,
								attributes: ["file_name", "id", "file_url"],
							},
							{
								model: this.settings.models.pdfFormRecipients,
								where: {
									status: { [Op.ne]: "revoked" },
								},
								attributes: [
									"id",
									"name",
									"email",
									"status",
									"color",
								],
							},
							{
								model: this.settings.models.users,
								attributes: [
									"id",
									"full_name",
									"email",
									"company_id",
									"user_type",
									"job_title",
								],
								include: [
									{
										model: this.settings.models
											.dropdown_job_title,
										where: {
											status: 1,
										},
										attributes: [
											"id",
											"dropdown_value",
											"status",
										],
										required: false,
									},
								],
								required: false,
							},
						],
					},
					{
						model: this.settings.models.pdfFormFields,
						include: [
							{
								model: this.settings.models.pdfFieldsOptions,
							},
							{
								model: this.settings.models.pdfFormRadioButtons,
							},
						],
					},
					{
						model: this.settings.models.users,
						attributes: [
							"id",
							"full_name",
							"email",
							"company_id",
							"user_type",
							"job_title",
						],
						include: [
							{
								model: this.settings.models.dropdown_job_title,
								where: {
									status: 1,
								},
								attributes: ["id", "dropdown_value", "status"],
								required: false,
							},
						],
						required: false,
					},
				],
				attributes: [
					"id",
					"name",
					"email",
					"company_id",
					"type",
					"user_id",
				],
			}
		);
		if (userFields) {
			// find company data

			const settingsData = await this.settings.models.settings.findOne({
				where: {
					company_id: userFields?.company_id,
				},
				attributes: [
					"id",
					"reminder_days",
					"session_timeout_for_recipient",
					"show_signer_name",
					"show_signer_datetime",
					"show_signer_ip",
					"show_signer_id",
				],
			});

			// find user signature data

			const signData =
				await this.settings.models.pdfFormSignatureInitials.findOne({
					where: {
						email: userFields?.email,
					},
					attributes: [
						"initials_url",
						"signature_url",
						"sign_uuid",
						"email",
					],
				});

			return {
				code: RESPONSES.status.success,
				message: "Recipients data successfully",
				data: {
					...userFields?.dataValues,
					settings: settingsData?.dataValues,
					signature: signData?.dataValues,
				},
			};
		} else {
			// form token changes
			const formData = await this.settings.models.pdfForms.findOne({
				where: {
					form_token: userToken,
					status: "completed",
				},
				include: [
					{
						model: this.settings.models.pdfFormFiles,
						attributes: ["file_name", "id", "file_url"],
					},
					{
						model: this.settings.models.pdfFormRecipients,
						where: {
							status: { [Op.ne]: "revoked" },
						},
						attributes: [
							"id",
							"name",
							"email",
							"status",
							"color",
							"form_id",
						],
					},
				],
			});

			if (formData) {
				return {
					code: RESPONSES.status.success,
					message: "Recipients data successfully",
					data: {
						...formData.dataValues?.pdf_form_recipients?.[0]
							?.dataValues,
						pdf_form: {
							...formData.dataValues,
						},
					},
				};
			}

			return {
				code: RESPONSES.status.error,
				message: "Token not available",
			};
		}
	} catch (error) {
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
			error: error.message,
		};
	}
}

async function fillFormFields(ctx) {
	const t = await sequelize.transaction({
		isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
		timeout: 5000,
	});
	try {
		// Check if multipart data exists
		const multipart = ctx.meta.$multipart || ctx.params;
		const {
			// signatures,
			id: recipientsId,
			formFields: formFieldsStr,
			token,
			formId,
			isSignatureRequired,
			digitalSignature,
			initialSignature,
			initialSignatureKey,
			digitalSignatureKey,
			// browser_details: browserDetailsStr,
		} = multipart;

		console.log(
			ctx.params.modifiedPdfBytes,
			"*************** modifiedPdfBytes ***************"
		);

		let formUrl = multipart.formUrl;
		let formFields = formFieldsStr;
		// let browserDetails = browserDetailsStr;

		console.log(
			ctx.meta.ip,
			ctx.meta.userAgent,
			"******************************** IP + *****"
		);
		if (ctx.meta?.$multipart) {
			try {
				// Parse JSON strings into objects if they exist
				formFields = formFieldsStr ? JSON.parse(formFieldsStr) : {};
			} catch (err) {
				console.log("err parsing fails", err);
				// If parsing fails, use empty objects as fallback
				formFields = formFieldsStr || {};
			}
		}

		// const { ip = "None", browser = "None" } = browserDetails;

		const parser = new UAParser();
		parser.setUA(ctx.meta.userAgent);
		const browserDetails = parser.getResult();
		const { browser: browserInfo, os } = browserDetails;
		const ip = ctx.meta.ip;
		const browser = `${browserInfo.name} ${os.name}`;

		// check if the token is valid
		const tokenDetails =
			await this.settings.models.pdfFormRecipients.findOne({
				where: {
					token,
					status: { [Op.ne]: "revoked" },
				},
			});

		if (!tokenDetails) {
			return {
				code: RESPONSES.status.error,
				message: "You are no longer assigned to this document",
			};
		}

		// Check if any recipient has declined the form
		const allRecipients =
			await this.settings.models.pdfFormRecipients.findAll({
				where: {
					form_id: formId,
					// status: { [Op.ne]: "revoked" },
				},
				attributes: ["id", "name", "email", "is_declined", "status"],
			});

		const declinedRecipient = allRecipients.find(
			(recipient) => recipient.is_declined
		);
		if (declinedRecipient) {
			return {
				code: RESPONSES.status.bad_request,
				message: `This document has been declined by ${
					declinedRecipient?.name || declinedRecipient?.email
				} and is no longer available for signing`,
			};
		}

		const formDetailsCreator = await this.settings.models.pdfForms.findOne({
			where: {
				id: formId,
				company_id: tokenDetails?.company_id,
			},
			include: [
				{
					model: this.settings.models.users,
					attributes: ["id", "full_name", "email", "company_id"],
				},
				{
					model: this.settings.models.companies,
					attributes: ["name", "id"],
				},
			],
		});

		const recipientDetails =
			await this.settings.models.pdfFormRecipients.findOne({
				where: {
					company_id: formDetailsCreator?.company_id,
					form_id: formId,
					id: recipientsId,
					status: { [Op.ne]: "revoked" },
				},
				include: [
					{
						model: this.settings.models.users,
						attributes: ["id", "full_name", "email", "company_id"],
					},
				],
				attributes: [
					"email",
					"name",
					"token",
					"type",
					"is_changed",
					"color",
					"user_id",
				],
			});

		const formDetails = await this.settings.models.pdfForms.findOne({
			where: {
				id: formId,
				// No need company_id, TenantId is required.....
			},
			attributes: [
				"id",
				"is_priority_required",
				"form_url",
				"company_id",
				"title",
				"attach_audit_log",
				"createdAt",
				"status",
				"document_id",
				"version",
				"is_deleted",
				"form_token",
			],
			lock: Transaction.LOCK.UPDATE,
			transaction: t,
		});

		const findRecipientStatus =
			await this.settings.models.pdfFormRecipients.findOne({
				where: {
					// company_id: formDetailsCreator?.company_id,
					form_id: formId,
					id: recipientsId,
				},
				transaction: t,
			});

		if (findRecipientStatus?.dataValues?.status === "completed") {
			try {
				// Release the transaction
				await t.commit();
				console.log(
					"Transaction committed successfully for completed document"
				);
			} catch (commitError) {
				console.error("Error committing transaction:", commitError);
				// Try to rollback if commit fails
				try {
					await t.rollback();
				} catch (rollbackError) {
					console.error(
						"Error rolling back transaction:",
						rollbackError
					);
				}
			}
			// Create a custom error object with properties that your error handler can use
			const error = new Error(
				"This document has been filled by the user"
			);
			error.code = RESPONSES.status.error;
			error.name = "DocumentAlreadyFilledError";
			error.data = {
				code: RESPONSES.status.error,
				message: "This document has been filled by the user",
			};
			// Throw the error to stop execution and propagate to error handler
			throw error;
		}

		if (formDetails?.status === "voided") {
			await t.commit();
			return {
				code: RESPONSES.status.bad_request,
				message:
					"This document has been voided by the sender and is no longer valid",
			};
		} else if (
			formDetails?.status === "deleted" ||
			formDetails?.is_deleted
		) {
			await t.commit();
			return {
				code: RESPONSES.status.bad_request,
				message:
					"This document has been deleted by the sender and is no longer available",
			};
		}
		// //checked the fields are updated or not
		// const anyUpdatedFields =
		// 	formDetails?.dataValues?.pdf_form_recipients.find(
		// 		(ri) => ri.token === token
		// 	);

		const anyUpdatedFields =
			recipientDetails && recipientDetails.token === token
				? recipientDetails
				: null;

		//If any fields are updated and at that time use opened the form then send reload check as status
		if (anyUpdatedFields?.is_changed) {
			await t.commit();
			return {
				code: RESPONSES.status.bad_request,
				status: RESPONSES.status.exist,
				message:
					"The document has been updated by the sender. Please refresh the page and try again",
			};
		}
		let companyDetails = await this.broker.call("companies.getById", {
			id: formDetails?.company_id,
		});
		const dir = "signify/forms";
		const localPath = "./assets/";
		let pdfPath;
		let combinedFilePath;

		// find signature and initials data

		if (recipientDetails?.dataValues?.type === "inside_organization") {
			const { email, user_id } = recipientDetails.dataValues || {};
			const { company_id } = formDetails || {};
			const updatedObj = {};

			if (initialSignature) {
				updatedObj.initials_url = initialSignature;
				updatedObj.initials_key = initialSignatureKey;
			}
			if (digitalSignature) {
				updatedObj.signature_url = digitalSignature;
				updatedObj.signature_key = digitalSignatureKey;
			}

			const whereClause = { email, user_id, company_id };

			// Check for previous stored signature/initials
			const previousData =
				await this.settings.models.pdfFormSignatureInitials.findOne({
					where: whereClause,
				});

			if (previousData) {
				const {
					initials_url,
					signature_url,
					initials_key,
					signature_key,
				} = previousData.dataValues || {};
				const previousFileArr = [];

				// Collect only changed files for deletion
				if (initialSignature && initials_url !== initialSignature) {
					previousFileArr.push(initials_key);
				}
				if (digitalSignature && signature_url !== digitalSignature) {
					previousFileArr.push(signature_key);
				}

				if (previousFileArr.length) {
					await this.bulkDeleteFromS3(
						previousFileArr.filter(Boolean)
					);
				}
			}

			// Update only if there's something to update
			if (Object.keys(updatedObj).length) {
				await this.settings.models.pdfFormSignatureInitials.update(
					updatedObj,
					{
						where: whereClause,
						transaction: t,
					}
				);
			}
		}
		if (!formDetails?.dataValues?.is_priority_required) {
			const { filePath, filledFileUrl } = await drawOnPDF.call(
				this,
				recipientsId,
				formDetails,
				formFields,
				companyDetails,
				dir,
				localPath,
				isSignatureRequired,
				recipientDetails,
				t
			);

			formUrl = filledFileUrl;
			pdfPath = filePath;
		}

		// delete signature and initials files which are not used after draw on pdf
		const pdfFormSignatureInitialsKeys = [
			...new Set(
				formFields?.flatMap((field) =>
					(field?.type === "digital signature" ||
						field?.type === "initials") &&
					field?.key
						? [field.key]
						: []
				)
			),
		];

		if (pdfFormSignatureInitialsKeys?.length > 0) {
			try {
				await this.bulkDeleteFromS3(pdfFormSignatureInitialsKeys);
			} catch (err) {
				console.log(
					"*******************Can't delete From S3****************",
					err
				);
			}
		}

		const signatureFieldsRecipients =
			await this.settings.models.pdfFormRecipients.findAll({
				where: {
					company_id: formDetails?.company_id,
					form_id: formId,
					[Op.and]: [
						{ status: { [Op.ne]: "revoked" } },
						{
							[Op.or]: [
								{ status: "mailed" },
								{ status: "viewed" },
								{ status: "pending" },
							],
						},
					],
				},
				transaction: t,
				attributes: ["id", "company_id"],
				include: [
					{
						model: this.settings.models.pdfFormFields,
						where: {
							type: "digital signature",
							status: "pending",
						},
						attributes: ["id", "company_id"],
					},
				],
			});

		const signRecipients = signatureFieldsRecipients?.filter(
			(data) => data?.pdf_form_fields?.length > 0
		);

		await Promise.all(
			formFields.map((field) => {
				this.settings.models.pdfFormFields.update(
					{
						field_Data:
							typeof field?.fieldData === "string"
								? field?.fieldData || null
								: null,
						selected_option: field?.selectedOption || null,
						status: "completed",
					},
					{
						where: {
							uuid_field_id: field?.fieldId,
							company_id: formDetails?.company_id,
						},
						// transaction: t,
					}
				);
			})
		);

		// Update recipient status to completed
		await this.settings.models.pdfFormRecipients.update(
			{
				status: "completed",
			},
			{
				where: {
					id: recipientsId,
					company_id: formDetails?.company_id,
				},
				// transaction: t,
			}
		);

		formDetails.version = formDetails.version + 0.1;
		await formDetails.save({ transaction: t });

		let signature = false;

		if (signRecipients.length === 1) {
			signature = true;
		}

		const pendingRecipients =
			await this.settings.models.pdfFormRecipients.count({
				where: {
					company_id: formDetails?.company_id,
					form_id: formId,
					[Op.not]: {
						[Op.or]: [
							{ status: "revoked" },
							{ status: "completed" },
							{ role: "viewer" },
						],
					},
				},
				transaction: t,
			});

		// Create PDF history
		await this.settings.models.pdfFormHistory.create(
			{
				company_id: formDetails?.company_id,
				activity: "Document has been Signed",
				action: "signed",
				browser,
				ip,
				form_id: formDetails?.id,
				performed_by:
					recipientDetails?.dataValues?.user?.dataValues?.id,
				// formDetails?.dataValues?.pdf_form_recipients[0]
				// 	?.user?.dataValues?.id,
				performer_name: recipientDetails?.dataValues?.name,
				// formDetails?.dataValues?.pdf_form_recipients[0]
				// 	?.name,
				performer_color: recipientDetails?.dataValues?.color,
				// formDetails?.dataValues?.pdf_form_recipients[0]
				// 	?.color,
			},
			{
				transaction: t,
			}
		);

		let combinedFileURL;
		if (pendingRecipients === 0) {
			const response = await addAuditLog.call(
				this,
				{
					full_name:
						formDetailsCreator?.dataValues?.user?.dataValues
							?.full_name,
					email: formDetailsCreator?.dataValues?.user?.dataValues
						?.email,
				},
				formDetails?.dataValues?.is_priority_required
					? formUrl
					: pdfPath, // pdfPath,
				formDetails?.dataValues?.is_priority_required,
				formDetails,
				companyDetails,
				dir,
				localPath,
				isSignatureRequired,
				t
			);
			if (isSignatureRequired) {
				combinedFilePath = response?.combinedFilePath;
			} else {
				formUrl = response?.url ? response?.url : formUrl;
				combinedFileURL = response?.combinedFileUrl;
			}

			// If it is a digitally signed file
			const signedResponse =
				isSignatureRequired &&
				signature &&
				!formDetails?.attach_audit_log
					? await applySign.call(
							this,
							formDetails?.dataValues?.is_priority_required
								? formUrl
								: pdfPath,
							formDetails,
							recipientDetails,
							companyDetails,
							dir,
							formDetails?.dataValues?.is_priority_required
					  )
					: null;

			if (!formDetails?.dataValues?.is_priority_required) {
				if (!isSignatureRequired || pendingRecipients > 0) {
					try {
						await fs.promises.unlink(pdfPath);
					} catch (err) {
						console.error("Error deleting PDF:", err);
					}
				}
			}

			// apply signature on combined file
			const combinedFileURLResponse =
				isSignatureRequired && signature && combinedFilePath
					? await applySign.call(
							this,
							combinedFilePath,
							formDetails,
							recipientDetails,
							companyDetails,
							dir
					  )
					: null;

			formUrl =
				isSignatureRequired && signature
					? signedResponse?.url
					: formUrl;

			if (
				isSignatureRequired &&
				signature &&
				formDetails?.attach_audit_log
			) {
				formUrl = combinedFileURLResponse?.url;
			}

			if (combinedFileURL || combinedFilePath) {
				formDetails.form_url = formUrl;
				formDetails.combined_file_url = combinedFileURLResponse?.url;
				await formDetails.save({ transaction: t });
			} else {
				formDetails.form_url = formUrl;
				await formDetails.save({ transaction: t });
			}
		} else {
			formDetails.form_url = formUrl;
			await formDetails.save({ transaction: t });

			// pdfPath is available delete it

			if (!formDetails?.dataValues?.is_priority_required) {
				try {
					await fs.promises.unlink(pdfPath);
				} catch (error) {
					console.log(
						"initial recipient wrote file is not deleted only for parallel recipients......................"
					);
				}
			}
		}

		if (formDetails?.dataValues?.is_priority_required) {
			checkPriorityEmail.call(
				this, // Added .call(this) to maintain context
				formId,
				formDetails?.dataValues?.title,
				formDetails?.company_id,
				recipientDetails?.dataValues?.name
			);
		} else {
			//check the Any recipient left for fill the form

			const recipients =
				await this.settings.models.pdfFormRecipients.findAll({
					where: {
						form_id: formId,
						company_id: formDetails?.company_id,
						[Op.and]: [
							{ status: { [Op.ne]: "revoked" } },
							{
								[Op.or]: [
									{ status: "mailed" },
									{ status: "viewed" },
									{ status: "pending" },
									{ status: "bounced" },
								],
							},
						],
						[Op.not]: {
							role: ["viewer"],
						},
					},
					attributes: ["id"],
					transaction: t,
				});

			if (recipients.length === 0) {
				formDetails.status = "completed";
				await formDetails.save({ transaction: t });

				// await this.settings.models.pdfForms.update(
				// 	{
				// 		status: "completed",
				// 	},
				// 	{
				// 		where: {
				// 			id: formId,
				// 			company_id: formDetails?.company_id,
				// 		},
				// 		transaction: t,
				// 	}
				// );

				await this.settings.models.pdfFormHistory.create(
					{
						activity: "Document has been Completed",
						action: "completed",
						form_id: formId,
						company_id: formDetails?.company_id,
						performer_name: "System",
					},
					{
						transaction: t,
					}
				);

				// Get all recipients of the form
				const filteredRecipients = allRecipients?.filter(
					(recipient) => recipient.status !== "revoked"
				);

				console.log(filteredRecipients, "FILTERED RECIPEINTS");

				// Send email to form creator/sender
				const senderMailData = await getEmailTemplateAndSendMail.call(
					this,
					formId,
					{
						name: formDetailsCreator?.dataValues?.user?.full_name,
						email: formDetailsCreator?.dataValues?.user?.email,
					},
					{
						title: formDetails?.title,
						token: formDetails?.form_token,
						// formUrl,
						user: {
							full_name:
								formDetailsCreator?.dataValues?.user?.full_name,
						},
						company: {
							name: formDetailsCreator?.dataValues?.company?.name,
						},
					},
					"document_signed_by_all_recipients"
				);

				// Send emails to all recipients
				const recipientMailPromises = filteredRecipients.map(
					(recipient) =>
						getEmailTemplateAndSendMail.call(
							this,
							formId,
							{
								name: recipient.name,
								email: recipient.email,
							},
							{
								title: formDetails?.title,
								token: formDetails?.form_token, // form token changes
								// formUrl,
								user: {
									full_name:
										formDetailsCreator?.dataValues?.user
											?.full_name,
								},
								company: {
									name: formDetailsCreator?.dataValues
										?.company?.name,
									id: formDetailsCreator?.dataValues?.company
										?.id,
								},
							},
							"document_signed_by_all_recipients"
						)
				);

				console.log(recipientMailPromises, "RECIPIENT PROMISES");

				const allMailData = await Promise.all([
					senderMailData,
					...recipientMailPromises,
				]);

				// allMailData.forEach((mailData) =>
				// this.sendEmail(mailData)  // Node mailer
				// );

				const allMailArr = allMailData?.filter(
					(r) => r !== undefined || r !== null
				);
				if (allMailArr?.length > 0) {
					this.broker.call("sesEmail.sendSliceSealForm", {
						mailArr: allMailArr,
					});
				}
			}
		}

		await t.commit();
		return {
			code: RESPONSES.status.success,
			message: "Form fields successfully filled",
		};
	} catch (error) {
		console.log(error, "**************************");

		if (t && error.name !== "DocumentAlreadyFilledError") {
			await t.rollback();
		}
		console.log(
			error.name,
			"************************** PDF transaction Lock error"
		);
		// Handle specific error types
		if (error.name === "SequelizeTimeoutError") {
			return {
				code: RESPONSES.status.error,
				message:
					"Form is currently being edited by another user. Please try again later.",
				error: error.message,
			};
		}

		if (error.name === "SequelizeDeadlockError") {
			return {
				code: RESPONSES.status.error,
				message: "Please try again in a few moments.",
				error: error.message,
			};
		}

		// if lock not released
		if (error.name === "LockNotReleasedError") {
			return {
				code: RESPONSES.status.error,
				message: "Please try again in a few moments.",
				error: error.message,
			};
		}

		if (error.name === "SequelizeDatabaseError") {
			return {
				code: RESPONSES.status.error,
				message: "Please try again in a few moments.",
				error: error.message,
			};
		}
		if (error.name === "SequelizeConnectionError") {
			return {
				code: RESPONSES.status.error,
				message: "Please try again in a few moments.",
				error: error.message,
			};
		}
		if (error.name === "LockNotReleasedError") {
			return {
				code: RESPONSES.status.error,
				message: "Please try again in a few moments.",
				error: error.message,
			};
		}
		console.error("Error in fillFormFields:", error);

		if (error.name === "DocumentAlreadyFilledError") {
			throw new MoleculerError(
				"This Document has been signed already",
				RESPONSES.status.bad_request,
				"This Document has been signed already"
			);
		}

		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
			error: error.message,
		};
	}
}
//Validate the Form Token
async function validateFormToken(ctx) {
	try {
		// No need company_id, TenantId is required

		const token = ctx.params.token;
		const browserDetails = ctx.params.browser_details || {};
		const { ip = "None", browser = "None" } = browserDetails;

		// checked if user is not revoked
		const validateData =
			await this.settings.models.pdfFormRecipients.findOne({
				where: {
					token,
				},
				include: [
					{
						model: this.settings.models.pdfForms,
						attributes: [
							"id",
							"status",
							"company_id",
							"form_url",
							"expiration_date",
							"void_reason",
							"is_deleted",
							"updatedAt",
							"reason_for_deletion",
						],
						include: [
							{
								model: this.settings.models.users,
								attributes: ["id", "email", "full_name"],
							},
						],
					},
					{
						model: this.settings.models.pdfFormFields,
						attributes: ["id", "type"],
					},
				],
			});

		//for revoked users
		const revokedUserData =
			!validateData &&
			(await this.settings.models.pdfFormRevokedUsers.findOne({
				where: {
					token,
				},
				include: [
					{
						model: this.settings.models.pdfForms,
						attributes: [
							"id",
							"status",
							"company_id",
							"form_url",
							"expiration_date",
							"void_reason",
							"is_deleted",
							"updatedAt",
							"reason_for_deletion",
						],
						include: [
							{
								model: this.settings.models.users,
								attributes: ["id", "email", "full_name"],
							},
						],
					},
				],
			}));

		// if any user send form_token then {form token changes}
		if (!validateData && !revokedUserData) {
			const formData = await this.settings.models.pdfForms.findOne({
				where: {
					form_token: token,
				},
			});

			if (!formData) {
				return {
					code: RESPONSES.status.unauthorized,
					message: "Invalid token",
				};
			} else {
				const settings = await findSliceSealSettingsByCompanyId(
					formData?.dataValues?.company_id
				);
				return {
					code: RESPONSES.status.success,
					message: "Token validated successfully",
					data: {
						...formData?.dataValues,
						settings: settings?.dataValues,
					},
				};
			}
		}

		if (
			validateData?.dataValues?.pdf_form?.dataValues?.is_deleted ||
			validateData?.dataValues?.pdf_form?.dataValues?.status ===
				"voided" ||
			validateData?.dataValues?.pdf_form?.dataValues?.status ===
				"expired" ||
			validateData?.dataValues?.pdf_form?.dataValues?.status ===
				"declined" ||
			// validateData?.dataValues?.status === "revoked"
			revokedUserData
		) {
			let declinedRecipients = [];
			// let settingsData = await this.broker.call(
			// 	"settings.getSettingsList",
			// 	{
			// 		company_id:
			// 			validateData?.dataValues?.pdf_form?.dataValues
			// 				?.company_id,
			// 	}
			// );

			const settingsData = await this.settings.models.settings.findOne({
				where: {
					company_id:
						validateData?.dataValues?.pdf_form?.dataValues
							?.company_id || revokedUserData?.company_id,
				},
			});

			if (
				validateData?.dataValues?.pdf_form?.dataValues?.status ===
				"declined"
			) {
				declinedRecipients =
					await this.settings.models.pdfFormRecipients.findAll({
						where: {
							form_id:
								validateData?.dataValues?.pdf_form?.dataValues
									?.id,
							is_declined: true,
						},
					});
			}

			if (validateData?.dataValues?.status === "mailed") {
				const viewedAt = new Date();
				await this.settings.models.pdfFormRecipients.update(
					{
						status: "viewed",
						viewedAt: viewedAt,
					},
					{
						where: {
							token,
							company_id: validateData?.company_id,
						},
					}
				);
			}
			return {
				code: 400,
				data: {
					...validateData?.dataValues,
					pdf_form: {
						...(validateData
							? validateData?.dataValues?.pdf_form?.dataValues
							: revokedUserData?.dataValues?.pdf_form
									?.dataValues),
						status:
							// validateData?.dataValues?.status ===
							// "revoked"
							revokedUserData
								? "removed"
								: validateData?.dataValues?.pdf_form?.dataValues
										?.status,
					},
					date_format: settingsData?.dataValues?.date_format,
					time_format: settingsData?.dataValues?.time_format,
					declinedRecipients,
				},
			};
		}

		// if (
		// 	validateData?.dataValues?.pdf_form?.dataValues
		// 		?.expiration_date
		// ) {
		// 	const expirationDate = new Date(
		// 		validateData.dataValues.pdf_form.dataValues.expiration_date
		// 	);
		// 	const today = new Date();
		// 	today.setHours(0, 0, 0, 0); // Set today's time to midnight for accurate comparison

		// 	if (expirationDate.getTime() <= today.getTime()) {
		// 		return {
		// 			code: RESPONSES.status.error,
		// 			message: "The document has expired.",
		// 		};
		// 	}
		// }

		// if status is mailed
		if (validateData?.dataValues?.status === "mailed") {
			await this.settings.models.pdfFormHistory.create({
				activity: `Document has been Viewed`,
				action: "viewed",
				browser,
				ip,
				form_id: validateData?.form_id,
				company_id: validateData?.company_id,
				performed_by: validateData?.user_id,
				performer_name: validateData?.name,
				performer_color: validateData?.color,
			});
			const viewedAt = new Date();

			// if (validateData?.dataValues?.role === "signer") {
			await this.settings.models.pdfFormRecipients.update(
				{
					status: "viewed",
					viewedAt: viewedAt,
				},
				{
					where: {
						token,
						company_id: validateData?.company_id,
					},
				}
			);
			// }
		}
		// if status is viewed
		if (
			validateData?.dataValues?.status === "viewed" ||
			validateData?.dataValues?.status === "mailed"
		) {
			await this.settings.models.pdfFormRecipients.update(
				{
					is_changed: false,
				},
				{
					where: {
						token,
						company_id: validateData?.company_id,
					},
				}
			);
		}

		// if (
		// 	validateData?.dataValues?.status === "completed" &&
		// 	validateData?.dataValues?.role === "signer"
		// ) {
		// 	return {
		// 		code: RESPONSES.status.success,
		// 		message: "You have submitted document.",
		// 		data: validateData,
		// 	};
		// }

		if (validateData) {
			const settings = await findSliceSealSettingsByCompanyId(
				validateData?.dataValues?.company_id
			);
			return {
				code: RESPONSES.status.success,
				message: "Token validated successfully",
				data: {
					...validateData?.dataValues,
					settings: settings?.dataValues,
				},
			};
		} else {
			return {
				code: RESPONSES.status.unauthorized,
				message: "Invalid token",
			};
		}
	} catch (error) {
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
			error: error.message,
		};
	}
}

//Checked and send Email Order wise
async function checkPriorityEmail(
	formId,
	formName,
	companyId,
	currentRecipientName
) {
	// No need company_id, TenantId is required

	const t = await sequelize.transaction();
	try {
		const formDetails = await this.settings.models.pdfForms.findOne({
			where: {
				id: formId,
			},
			attributes: ["id", "form_url", "company_id", "title"],
			include: [
				{
					model: this.settings.models.pdfFormRecipients,
					where: {
						status: { [Op.or]: ["pending", "bounced"] },

						// [Op.not]: {
						// 	role: ["viewer"],
						// },
					},
					attributes: [
						"id",
						"email",
						"name",
						"token",
						"type",
						"role",
						"r_priority",
					],
					order: [["r_priority", "ASC"]],
				},
				{
					model: this.settings.models.users,
					attributes: ["id", "email", "full_name"],
				},
				{
					model: this.settings.models.companies,
					attributes: ["name", "id"],
				},
				{
					model: this.settings.models.pdfFormFiles,
					attributes: ["file_name"],
				},
			],
		});

		// const nextRecipientDetails =
		// 	nextRecipient?.dataValues?.pdf_form_recipients[0];

		// console.log(nextRecipientDetails);
		// const nextFirstSignerDetails = nextRecipients?.find( r => r.role === "signer");

		// const nextFirstSignerIndex = nextRecipients?.findIndex( r => r.role === "signer");
		// const nextViewersDetails = nextRecipients?.splice( ,nextFirstSignerIndex); // next viewer till nextFirstSignerDetails

		const sortedRecipientsArr =
			formDetails?.dataValues?.pdf_form_recipients.sort(
				(a, b) => a.r_priority - b.r_priority
			);

		const { signer, viewer } = identifySignerAndViewer(sortedRecipientsArr);

		if (viewer) {
			const viewersArr = await Promise.all(
				viewer?.map(async (v) => {
					const isSuppressed =
						v &&
						(await this.isEmailSuppressed(
							v?.email || v?.dataValues?.email
						));

					await this.settings.models.pdfFormRecipients.update(
						{
							status: isSuppressed ? "bounced" : "mailed",
						},
						{
							where: {
								id: v?.id || v?.dataValues?.id,
							},
						}
					);

					await this.settings.models.pdfFormHistory.create({
						activity: `Document has	 been sent to the ${
							v?.name || v?.dataValues?.name
						}`,
						action: "mailed",
						form_id: formId,
						company_id: companyId,
						performer_name: currentRecipientName,
					});

					const mailData = await getEmailTemplateAndSendMail.call(
						this,
						formId,
						{
							name: v?.name || v?.dataValues?.name, //nextRecipientDetails?.name,
							email: v?.email || v?.dataValues?.email, // nextRecipientDetails?.email,
							token: v?.token || v?.dataValues?.token,
							role: v?.role || v?.dataValues?.role,
						},
						{
							title: formDetails?.title,
							user: {
								full_name:
									formDetails?.dataValues?.user?.full_name,
								email: formDetails?.dataValues?.user?.email,
							},
							company: {
								name:
									v.dataValues?.company?.name ||
									formDetails?.dataValues?.company?.name,
								id:
									v?.dataValues?.company?.id ||
									formDetails?.dataValues?.company?.id,
							},
						},
						"document_viewer"
					);
					return mailData;
				})
			);
			// 	viewersArr?.forEach((v) =>
			// 		//  this.sendEmail(v) nodeMailer
			// );

			const mailArr = viewersArr?.filter(
				(v) => v !== undefined || v !== null
			);
			console.log(
				"**************** CheckPriority  Viewer mail ***********************"
			);
			if (mailArr?.length > 0) {
				this.broker.call("sesEmail.sendSliceSealForm", {
					mailArr,
					trackEvent: true,
				});
			}
		}

		// Prepare mail for upcoming users.
		if (signer?.[0]) {
			const isSuppressed =
				signer?.[0] &&
				(await this.isEmailSuppressed(
					signer?.[0]?.email || signer?.[0]?.dataValues?.email
				));

			await this.settings.models.pdfFormRecipients.update(
				{
					status: isSuppressed ? "bounced" : "mailed",
				},
				{
					where: {
						id: signer?.[0]?.id || signer?.[0]?.dataValues?.id,
					},
				}
			);

			await this.settings.models.pdfFormHistory.create({
				activity: `Document has been sent to  ${
					signer?.[0]?.name || signer?.[0]?.dataValues?.name
				}`,
				action: "mailed",
				form_id: formId,
				company_id: companyId,
				performer_name: formDetails?.dataValues?.user?.full_name,
				performed_by: formDetails?.dataValues?.user?.id,
			});

			// Send email to the recipient

			const mailData = await getEmailTemplateAndSendMail.call(
				this,
				formId,
				{
					name: signer?.[0]?.name || signer?.[0]?.dataValues?.name, //nextRecipientDetails?.name,
					email: signer?.[0]?.email || signer?.[0]?.dataValues?.email, // nextRecipientDetails?.email,
					token: signer?.[0]?.token || signer?.[0]?.dataValues?.token,
				},
				{
					title: formDetails?.title,
					token: formDetails?.form_token, // form token changes
					user: {
						full_name: formDetails?.dataValues?.user?.full_name,
						email: formDetails?.dataValues?.user?.email,
					},
					company: {
						name:
							signer?.[0]?.dataValues?.company?.name ||
							formDetails?.dataValues?.company?.name,
						id:
							signer?.[0]?.dataValues?.company?.id ||
							formDetails?.dataValues?.company?.id,
					},
				},
				"document_sign_request"
			);

			// this.sendEmail(mailData); // Node Mailer
			console.log(
				"**************** CheckPriority sender mail ***********************"
			);
			if (mailData) {
				this.broker.call("sesEmail.sendSliceSealForm", {
					mailArr: [mailData],
					trackEvent: true,
				});
			}
		} else {
			console.log("No more recipients to send email");
			await this.settings.models.pdfForms.update(
				{
					status: "completed",
				},
				{
					where: {
						id: formId,
						company_id: companyId,
					},
				}
			);
			await this.settings.models.pdfFormHistory.create({
				activity: "Document has been Completed",
				action: "completed",
				form_id: formId,
				company_id: companyId,
				performer_name: "System",
			});

			// Send email to the recipient all signer and viewer and sender

			// email to all recipients

			const allRecipients =
				await this.settings.models.pdfFormRecipients.findAll({
					where: {
						form_id: formId,
						company_id: companyId,
						status: { [Op.ne]: "revoked" },
					},
					include: [
						{
							model: this.settings.models.users,
							attributes: ["email", "full_name", "id"],
						},
						{
							model: this.settings.models.companies,
							attributes: ["name", "id"],
						},
						{
							model: this.settings.models.pdfForms,
							include: [
								{
									model: this.settings.models.users,
									attributes: ["email", "full_name", "id"],
								},
							],
						},
					],
				});

			// email to sender
			const mailData = await getEmailTemplateAndSendMail.call(
				this,
				formId,
				{
					name: allRecipients?.[0]?.dataValues?.pdf_form?.dataValues
						?.user?.full_name,
					email: allRecipients?.[0]?.dataValues?.pdf_form?.dataValues
						?.user?.email,
				},
				{
					title:
						allRecipients?.[0]?.dataValues?.pdf_form?.title ||
						formName,
					token: allRecipients?.[0]?.dataValues?.pdf_form?.form_token, // form token changes
					// formUrl:
					// 	allRecipients?.[0]?.dataValues?.pdf_form
					// 		?.form_url,
					user: {
						full_name:
							allRecipients?.[0]?.dataValues?.pdf_form?.dataValues
								?.user?.full_name,
						email: allRecipients?.[0]?.dataValues?.pdf_form
							?.dataValues?.user?.email,
					},
					company: {
						name: allRecipients?.dataValues?.company?.name,
						id: allRecipients?.dataValues?.company?.id,
					},
				},
				"document_signed_by_all_recipients"
			);

			const recipientDataArr = await Promise.all(
				allRecipients?.map((r) => {
					const rEmail = getEmailTemplateAndSendMail.call(
						this,
						formId,
						{
							name: r?.name,
							email: r?.email,
						},
						{
							title:
								allRecipients?.[0]?.dataValues?.pdf_form
									?.title || formName,
							// formUrl:
							// 	allRecipients?.[0]?.dataValues?.pdf_form
							// 		?.form_url,
							token: allRecipients?.[0]?.dataValues?.pdf_form
								?.form_token,
							user: {
								full_name:
									r?.dataValues?.pdf_form?.dataValues?.user
										?.full_name,
								email: r?.dataValues?.pdf_form?.dataValues?.user
									?.email,
							},
							company: {
								name: r?.dataValues?.company?.name,
								id: r?.dataValues?.company?.id,
							},
						},
						"document_signed_by_all_recipients"
					);
					return rEmail;
				})
			);

			console.log(
				"**************** Fully signed  email to sender ***********************"
			);
			// this.sendEmail(mailData); // Node mailer
			if (mailData) {
				this.broker.call("sesEmail.sendSliceSealForm", {
					mailArr: [mailData],
				});
			}

			// recipientDataArr?.forEach((r) =>
			// 	this.sendEmail(r) //Node mailer
			// );

			const mailArr = recipientDataArr?.filter(
				(r) => r !== null || r !== undefined
			);

			console.log(
				"**************** Fully signed  email to all recipients ***********************"
			);
			if (mailArr?.length > 0) {
				this.broker.call("sesEmail.sendSliceSealForm", {
					mailArr: mailArr,
				});
			}
		}
		await t.commit();
		return;
	} catch (error) {
		await t.rollback();
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
			error: error.message,
		};
	}
}

// Get All Forms
async function getAllSubmissions(ctx) {
	// const fileId = ctx.params.id;
	const companyId = ctx?.meta?.user?.company_id;

	try {
		let page =
			parseInt(ctx.params.page ? ctx.params.page : undefined, 10) || 1;
		let limit =
			parseInt(ctx.params.limit ? ctx.params.limit : undefined, 10) ||
			Number(process.env.PAGE_LIMIT);
		let offset = (page - 1) * limit;
		const search = ctx?.params?.search || "";
		let sortBy = ctx.params.sortBy ? ctx.params.sortBy : "title";
		let order = ctx.params.order ? ctx.params.order : "DESC";
		const filter = JSON.parse(ctx?.params?.filter || "{}");
		let whereCondition = {
			company_id: companyId,
			created_by: ctx?.meta?.user?.id,
			is_template: false,
			is_deleted: false,
		};

		if (search && search !== "") {
			whereCondition = {
				...whereCondition,
				[Op.or]: [
					{
						title: {
							[Op.like]: `%${search}%`,
						},
					},
				],
			};
		}

		if (filter !== "" && filter?.status?.length) {
			whereCondition = {
				...whereCondition,
				status: {
					[Op.in]: filter.status,
				},
			};
		}

		if (filter?.date && filter?.date?.length) {
			whereCondition = {
				...whereCondition,
				createdAt: {
					[Op.and]: [
						{
							[Op.gte]: moment(filter.date[0]).startOf("days"),
						},
						{
							[Op.lte]: moment(filter.date[1]).endOf("days"),
						},
					],
				},
			};
		}

		// Tag filter - Modified to use OR condition
		if (filter?.tags?.length) {
			whereCondition = {
				...whereCondition,
				id: {
					[Op.in]: sequelize.literal(`(
                        SELECT DISTINCT pdf_form_id 
                        FROM pdf_form_tags 
                        WHERE pdf_tag_id IN (${filter.tags.join(",")})
                    )`),
				},
			};
		}

		const submissions = await this.settings.models.pdfForms.findAll({
			where: whereCondition,
			include: [
				{
					model: this.settings.models.pdfFormRecipients,
					where: {
						status: { [Op.ne]: "revoked" },
					},
					// separate: true, // Fetch pdfFormRecipients in a separate query
					order: [["r_priority", "ASC"]], // Sort by r_priority directly in the query
					include: [
						{
							model: this.settings.models.users,
						},
					],
				},
				{
					model: this.settings.models.users,
				},
				{
					model: this.settings.models.pdfFormFiles,
				},
				{
					model: this.settings.models.pdfFormTags,
					attributes: ["id", "pdf_tag_id"],
					required: false, // Make it a LEFT JOIN
				},
			],

			limit,
			offset: offset || undefined,
			order: [[`${sortBy}`, `${order}`]],
			distinct: true,
		});

		// // Sort pdfFormRecipients by r_priority after fetching
		submissions.forEach((submission) => {
			submission.pdfFormRecipients =
				submission.dataValues?.pdf_form_recipients?.sort(
					(a, b) =>
						a?.dataValues?.r_priority - b?.dataValues?.r_priority
				);
		});

		const totalRecords = await this.settings.models.pdfForms.count({
			where: whereCondition,
		});

		return {
			code: RESPONSES.status.success,
			message: "Submissions retrieved successfully",
			data: submissions,
			totalRecords,
		};
	} catch (error) {
		console.log(error, "SUBMISION ERROR");
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}

//Apply Signature
async function applySign(
	pdfFilePath,
	formDetails,
	recipientDetails,
	companyDetails,
	dir,
	isPriorityRequired
) {
	try {
		// let pdfData = isPriorityRequired ? null : formUrl;
		// const response =
		// 	isPriorityRequired &&
		// 	(await axios.get(formUrl, {
		// 		responseType: "arraybuffer",
		// 	}));
		// const fileBuffer =
		// 	isPriorityRequired && Buffer.from(response.data, "utf-8");

		// certificate path
		const certificatePath = path.join(
			__dirname,
			"..",
			"..",
			"assets",

			"certificates",
			"client-identity.p12"
		);

		const certificateBuffer = fs.readFileSync(certificatePath);

		const signer = new P12Signer(certificateBuffer, {
			passphrase: "test1234",
		});

		const response =
			isPriorityRequired &&
			(await axios.get(pdfFilePath, {
				responseType: "arraybuffer",
			}));
		const fileBuffer =
			isPriorityRequired && Buffer.from(response.data, "utf-8");

		const fileData =
			!isPriorityRequired && (await fs.promises.readFile(pdfFilePath));
		const pdfDoc = await PDFDocument.load(
			isPriorityRequired ? fileBuffer : fileData
		);

		// // Add a placeholder for validation
		pdflibAddPlaceholder({
			pdfDoc: pdfDoc,
			reason: "Validation of PDF document",
			contactInfo:
				recipientDetails?.dataValues?.email || recipientDetails?.email,
			name: recipientDetails?.dataValues?.name || recipientDetails?.name,
			location: "Somewhere on earth!",
		});

		const pdfWithPlaceholderBytes = await pdfDoc.save();

		//Sign the pdf
		const signedPdf = await signpdf.sign(
			pdfWithPlaceholderBytes,
			// pdfDoc,
			signer
		);
		let fileName = formDetails?.dataValues?.title;

		let file = {
			buffer: {
				data: signedPdf,
			},
			size: signedPdf.byteLength / 1024 / 1024,
			originalname: fileName,
			mimetype: "application/pdf",
		};

		// S3 directory
		// await this.fileDeleteFromS3("_", formUrl);

		//Upload File via s3 function
		const pdfResponse = await this.directUpload(
			file,
			dir,
			companyDetails?.data?.name
		);

		pdfFilePath && !isPriorityRequired && fs.promises.unlink(pdfFilePath);

		return pdfResponse;
	} catch (error) {
		console.log(error);
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}
//Get All Templates
async function getAllFiles(ctx) {
	try {
		// Pagination
		const page =
			parseInt(ctx.params.page ? ctx.params.page : undefined, 10) || 1;
		const limit =
			parseInt(ctx.params.limit ? ctx.params.limit : undefined, 10) ||
			Number(process.env.PAGE_LIMIT);
		const offset = (page - 1) * limit;
		const companyId =
			ctx?.meta?.user?.company_id || ctx?.params?.company_id;
		const search = ctx.params.search ? ctx.params.search : "";
		const sortBy = ctx.params.sortBy ? ctx.params.sortBy : "createdAt";
		const order = ctx.params.order ? ctx.params.order : "DESC";
		let whereCondition = {
			company_id: companyId,
			created_by: ctx?.meta?.user?.id,
			is_deleted: false,
		};

		if (search !== "") {
			whereCondition = {
				...whereCondition,
				file_name: { [Op.like]: `%${search}%` },
			};
		}

		const files = await this.settings.models.pdfFormFiles.findAll({
			where: {
				...whereCondition,
			},
			include: [
				{
					model: this.settings.models.users,
					attributes: [
						"id",
						"full_name",
						"email",
						"profile_bg_color",
						"profile_pic",
					],
				},
			],
			attributes: ["id", "file_name", "size", "createdAt", "file_url"],
			limit,
			order: [[sortBy, order]],
			offset: offset || null,
		});

		const totalRecords = await this.settings.models.pdfFormFiles.count({
			where: {
				company_id: companyId,
				...whereCondition,
			},
		});

		return {
			code: RESPONSES.status.success,
			message: "Files retrieved successfully",
			data: files,
			totalRecords,
		};
	} catch (error) {
		console.log(error);
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}

// Uploaded the Pdf File
async function uploadPdfFile(ctx) {
	const t = await sequelize.transaction();
	try {
		const companyId =
			ctx?.meta?.user?.company_id || ctx?.params?.company_id;
		const files = ctx.params.files;

		const fileData = files.map((file) => ({
			company_id: companyId,
			file_name: file?.filename,
			size: file?.size,
			file_url: file?.url,
			key: file?.key,
			created_by: ctx?.meta?.user?.id,
		}));

		const data = await this.settings.models.pdfFormFiles.bulkCreate(
			fileData,
			{
				transaction: t,
			}
		);
		await t.commit();
		return {
			code: RESPONSES.status.success,
			message: "Files uploaded successfully",
			data: data,
		};
	} catch (error) {
		await t.rollback();
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}
//Check the duplicate File
async function checkDuplicateFile(ctx) {
	try {
		const fileName = ctx.params.fileName;
		const companyId =
			ctx?.meta?.user?.company_id || ctx?.params?.company_id;

		const isDuplicate = await this.settings.models.pdfFormFiles.findOne({
			where: {
				file_name: fileName,
				company_id: companyId,
			},
			attributes: ["id"],
		});

		if (isDuplicate) {
			return {
				code: RESPONSES.status.exist,
				message: "Duplicate File Name",
			};
		}
		return {
			code: RESPONSES.status.success,
			message: "No duplicate file found",
		};
	} catch (error) {
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}
//Delete Template
async function deleteFile(ctx) {
	const t = await sequelize.transaction();
	try {
		const fileId = ctx.params.id;
		const companyId = ctx.meta.company_id;
		const fileData = await this.settings.models.pdfFormFiles.findOne({
			where: {
				id: fileId,
				company_id: companyId,
			},
			include: [
				{
					model: this.settings.models.pdfForms,
					as: "file_forms",
				},
			],
			attributes: ["key", "id"],
		});

		const pdfFormData = fileData?.dataValues?.file_forms;

		await Promise.all(
			pdfFormData.map(async (form) => {
				if (form?.dataValues?.is_template) {
					await this.settings.models.pdfForms.update(
						{
							file_id: null,
							status: "deleted",
							is_deleted: true,
						},
						{
							where: {
								id: form.id,
								company_id: companyId,
							},
							transaction: t,
						}
					);
				} else {
					await this.settings.models.pdfForms.update(
						{ file_id: null },
						{
							where: {
								id: form.id,
								company_id: companyId,
							},
							transaction: t,
						}
					);
				}
			})
		);

		await this.settings.models.pdfFormFiles.update(
			{ is_deleted: true },
			{
				where: {
					id: fileId,
					company_id: companyId,
				},
				transaction: t,
			}
		);

		// s3 operations

		// await this.fileDeleteFromS3(fileData?.dataValues?.key);
		await t.commit();
		return {
			code: RESPONSES.status.success,
			message: RESPONSES.messages.success,
		};
	} catch (error) {
		await t.rollback();
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}

//Void the Form
async function voidForm(ctx) {
	const t = await sequelize.transaction();
	try {
		const formId = ctx.params.formId;
		const reason = ctx.params.reason;

		const companyId =
			ctx?.meta?.user?.company_id || ctx?.params?.company_id;

		const formData = await this.settings.models.pdfForms.findOne({
			where: {
				id: formId,
				company_id: companyId,
				// status: "pending",
				status: {
					[Op.or]: ["pending", "expired"],
				},
			},
			attributes: ["id", "title", "status", "form_url", "key"],

			include: [
				{
					model: this.settings.models.pdfFormRecipients,
					where: {
						status: {
							[Op.and]: [
								{ [Op.ne]: "revoked" },
								{
									[Op.or]: [
										"mailed",
										"viewed",
										"completed",
										"bounced",
									],
								},
							],
						},
					},
				},
				{
					model: this.settings.models.users,
					attributes: ["id", "email", "full_name"],
				},
				{
					model: this.settings.models.companies,
					attributes: ["name", "id"],
				},
			],
		});

		if (!formData) {
			await t.rollback();
			return {
				code: RESPONSES.status.error,
				message:
					"Document could not be voided. Please refresh the page.",
			};
		}

		// const recipientData = formData?.dataValues?.pdf_form_recipients;

		// Promise.all(
		// 	recipientData.map(async (recipient) => {
		// 		await this.settings.models.pdfFormRecipients.update(
		// 			{
		// 				status: "void",
		// 			},
		// 			{
		// 				where: {
		// 					id: recipient.id,
		// 					company_id: companyId,
		// 				},
		// 			}
		// 		);
		// 	})
		// );

		await this.settings.models.pdfForms.update(
			{
				status: "voided",
				void_reason: reason,
			},
			{
				where: {
					company_id: companyId,
					id: formId,
				},
				transaction: t,
			}
		);

		const fileName = formData?.dataValues?.title;
		const formUrl = formData?.dataValues?.form_url;

		const fileStream = await this.readFileIntoBuffer(formUrl);

		//  Added the WaterMark
		const newBufferData = await addTextWatermark(fileName, fileStream);

		//Need to upload the file

		let file = {
			buffer: {
				data: newBufferData,
			},
			size: newBufferData?.byteLength / 1024 / 1024,
			originalname: fileName,
			mimetype: "application/pdf",
		};

		let findCompany = await this.broker.call("companies.getById", {
			id: companyId,
		});

		const dir = `signify/void`;
		const pdfResponse = await this.directUpload(
			file,
			dir,
			findCompany?.data?.name
		);

		//delete the old form  form s3 file

		// Need to check cases for it.
		// await this.fileDeleteFromS3(formKey);

		await this.settings.models.pdfForms.update(
			{
				form_url: pdfResponse?.url,
				key: pdfResponse?.Key,
			},
			{
				where: {
					id: formId,
					company_id: companyId,
				},
				transaction: t,
			}
		);
		// Create the History
		await this.settings.models.pdfFormHistory.create(
			{
				activity: "Document has been Voided",
				action: "voided",
				form_id: formId,
				company_id: companyId,
				performed_by: ctx?.meta?.user?.id,
			},
			{
				transaction: t,
			}
		);

		const mailData = await Promise.all(
			formData?.dataValues?.pdf_form_recipients?.map(async (r) => {
				const mailData = await getEmailTemplateAndSendMail.call(
					this,
					formData?.id,
					{
						name: r?.name,
						email: r?.email,
					},
					{
						title: formData?.title,
						user: {
							full_name: formData?.dataValues?.user?.full_name,
							email: formData?.dataValues?.user?.email,
						},
						company: {
							name: formData?.dataValues?.company?.name,
							id: formData?.dataValues?.company?.id,
						},
					},
					"document_voided",
					false,
					"",
					"",
					reason
				);

				return mailData;
			})
		);

		// mailData.forEach((r) =>
		// this.sendEmail(r) // Node mailer

		// );
		const mailArr = mailData?.filter((r) => r !== undefined || r !== null);

		console.log(
			"**************** void document all recipients ***********************"
		);
		if (mailArr?.length > 0) {
			this.broker.call("sesEmail.sendSliceSealForm", {
				mailArr: mailArr,
			});
		}

		// send email to the creator
		const creatorMailData = await getEmailTemplateAndSendMail.call(
			this,
			formData?.id,
			{
				name: formData?.dataValues?.user?.full_name,
				email: formData?.dataValues?.user?.email,
			},
			{
				title: formData?.title,
				user: {
					full_name: formData?.dataValues?.user?.full_name,
					email: formData?.dataValues?.user?.email,
				},
				company: {
					name: formData?.dataValues?.company?.name,
					id: formData?.dataValues?.company?.id,
				},
			},
			"document_voided",
			false,
			"",
			"",
			reason
		);

		// this.sendEmail(creatorMailData);
		console.log(
			"**************** void document to sender ***********************"
		);
		if (creatorMailData) {
			this.broker.call("sesEmail.sendSliceSealForm", {
				mailArr: [creatorMailData],
			});
		}

		await t.commit();
		return {
			code: RESPONSES.status.success,
			message: "Form and recipients processed successfully",
		};
	} catch (error) {
		await t.rollback();
		console.log(error);
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}

//Added the Image Watermark
async function addImageWatermark(fileName, fileStream) {
	try {
		const pdfDoc = await PDFDocument.load(fileStream);

		const imagePath = path.join(
			__dirname,
			"..",
			"..",
			"assets",
			"certificates",
			"Rejected.png"
		);

		const imageBytes = fs.readFileSync(imagePath);

		const image = await pdfDoc.embedPng(imageBytes);
		const imageWidth = image.width;
		const imageHeight = image.height;

		const pages = pdfDoc.getPages();

		for (const page of pages) {
			const { width, height } = page.getSize();
			console.log(width, imageWidth, height, imageHeight);
			page.drawImage(image, {
				x: width - 210,
				y: 0,
				width: 200,
				height: 200,
			});
		}

		const pdfBytes = await pdfDoc.save();

		const outputFilePath = path.join(
			__dirname,
			"..",
			"..",
			"assets",
			"certificates",
			`${fileName}`
		);

		fs.writeFileSync(outputFilePath, pdfBytes);
		console.log("PDF watermark added successfully");
	} catch (error) {
		console.log(error, "WATERMARK ERROR");
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}
// Get All the Fields
async function getAllFields(ctx) {
	try {
		const id = ctx.params.id;
		const mode = ctx.params.mode;
		const checkFormStatus =
			ctx?.params?.checkFormStatus === "true" ? true : false;
		let companyId = ctx?.meta?.user?.company_id || ctx?.params?.company_id;
		const whereCondition =
			mode === "template"
				? {
						file_id: id,
						company_id: companyId,
						is_template: true,
				  }
				: {
						id,
						company_id: companyId,
				  };

		let formData = await this.settings.models.pdfForms.findOne({
			where: whereCondition,

			include: [
				{
					model: this.settings.models.pdfFormRecipients,
					where: {
						status: { [Op.ne]: "revoked" },
					},
					include: [
						{
							model: this.settings.models.users,
							attributes: [
								"id",
								"full_name",
								"profile_pic",
								"profile_bg_color",
							],
						},
					],
				},
				{
					model: this.settings.models.pdfFormFields,
					include: [
						{
							model: this.settings.models.pdfFieldsOptions,
						},
						{
							model: this.settings.models.pdfFormRadioButtons,
						},
					],
				},
				{
					model: this.settings.models.pdfFormFiles,
				},
				{
					model: this.settings.models.users,
					attributes: [
						"id",
						"full_name",
						"profile_pic",
						"profile_bg_color",
					],
				},
				{
					model: this.settings.models.pdfFormHistory,
					include: [
						{
							model: this.settings.models.users,
							attributes: [
								"id",
								"full_name",
								"profile_pic",
								"profile_bg_color",
							],
						},
					],
				},
				{
					model: this.settings.models.pdfFormTags,
					attributes: ["id", "pdf_tag_id"],
					required: false, // Make it a LEFT JOIN
					include: [
						{
							model: this.settings.models.pdfTags,
							as: "tag_details",
							attributes: ["id", "tag_name"],
						},
					],
				},
			],
		});

		formData.dataValues.pdf_form_recipients =
			formData.dataValues.pdf_form_recipients.sort(
				(a, b) => a?.dataValues?.r_priority - b?.dataValues?.r_priority
			);

		// if (id && !formData) {
		// 	formData = await this.settings.models.pdfFormFiles.findOne({
		// 		where: {
		// 			id,
		// 			company_id: companyId,
		// 		},
		// 	});
		// }

		if (
			checkFormStatus &&
			(formData?.dataValues?.status === "declined" ||
				formData?.dataValues?.status === "completed")
		) {
			return {
				code: RESPONSES.status.error,
				message:
					"Document could not be corrected, Please refresh the page",
				data: formData,
			};
		}

		if (!formData) {
			return {
				code: RESPONSES.status.error,
				message: "The Template you selected is no longer available",
			};
		}

		return {
			code: RESPONSES.status.success,
			message: RESPONSES.messages.success,
			data: formData,
		};
	} catch (error) {
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
			error: error.message,
		};
	}
}

// Delete the form
async function deleteForm(ctx) {
	const t = await sequelize.transaction();
	try {
		const id = ctx.params.id;
		const reason = ctx.params.reason_for_deletion;
		const companyId =
			ctx?.meta?.user?.company_id || ctx?.params?.company_id;

		const formDetails = await this.settings.models.pdfForms.findOne({
			where: {
				id,
				company_id: companyId,
			},
			include: [
				{
					model: this.settings.models.pdfFormRecipients,
					where: {
						status: {
							[Op.and]: [
								{ [Op.ne]: "revoked" },
								{
									[Op.or]: [
										"mailed",
										"viewed",
										"completed",
										"bounced",
									],
								},
							],
						},
					},
					required: false,
				},
				{
					model: this.settings.models.companies,
					attributes: ["name", "id"],
				},
				{
					model: this.settings.models.users,
					attributes: ["id", "email", "full_name"],
				},
			],
			attributes: ["id", "key", "title", "status"],
		});

		if (formDetails?.status === "completed") {
			await t.rollback();
			return {
				code: RESPONSES.status.error,
				message: "Document has been Completed, Please refresh the page",
				data: formDetails,
			};
		}

		// else if (formDetails?.status === "declined") {
		// 	// find the declined user

		// 	const declinedUserData =
		// 		formDetails?.dataValues?.pdf_form_recipients?.dataValues?.find(
		// 			(r) => (r.is_declined = true)
		// 		);

		// 	return {
		// 		code: RESPONSES.status.error,
		// 		message: `This document has been declined by ${
		// 			declinedUserData?.name || declinedUserData?.email
		// 		} and is no longer available.`,
		// 	};
		// }

		// await this.fileDeleteFromS3(formDetails?.dataValues?.key);
		await this.settings.models.pdfForms.update(
			{
				is_deleted: true,
				reason_for_deletion: reason,
				status: "deleted",
			},
			{
				where: {
					id,
					company_id: companyId,
				},
				transaction: t,
			}
		);

		if (formDetails?.dataValues?.status === "draft") {
			t.commit(); // Here we need commit
			return {
				code: RESPONSES.status.success,
				message: RESPONSES.messages.success,
			};
		}

		const recipientData = await Promise.all(
			formDetails?.dataValues?.pdf_form_recipients.map(async (r) => {
				const maildata = await getEmailTemplateAndSendMail.call(
					this,
					id,
					{
						name: r.name,
						email: r.email,
					},
					{
						title: formDetails?.title,
						user: {
							full_name: formDetails?.dataValues?.user?.full_name,
							email: formDetails?.dataValues?.user?.email,
						},
						company: {
							name: formDetails?.dataValues?.company?.name,
							id: formDetails?.dataValues?.company?.id,
						},
					},
					"document_deleted",
					false,
					"",
					"",
					reason
				);
				return maildata;
			})
		);
		// Send email
		// recipientData.forEach((r) =>
		//	 this.sendEmail(r) // Node mailer

		// );

		const recipientArr = recipientData?.filter(
			(r) => r !== null || r !== undefined
		);
		console.log(
			"**************** delete document all recipients ***********************"
		);
		if (recipientArr?.length > 0) {
			this.broker.call("sesEmail.sendSliceSealForm", {
				mailArr: recipientArr,
			});
		}
		// send email to the creator
		const creatorMailData = await getEmailTemplateAndSendMail.call(
			this,
			id,
			{
				name: formDetails?.dataValues?.user?.full_name,
				email: formDetails?.dataValues?.user?.email,
			},
			{
				title: formDetails?.title,
				user: {
					full_name: formDetails?.dataValues?.user?.full_name,
					email: formDetails?.dataValues?.user?.email,
				},
				company: {
					name: formDetails?.dataValues?.company?.name,
					id: formDetails?.dataValues?.company?.id,
				},
			},
			"document_deleted",
			false,
			"",
			"",
			reason
		);

		// this.sendEmail(creatorMailData); // Node Mailer
		console.log(
			"**************** delete document to sender ***********************"
		);
		if (creatorMailData) {
			this.broker.call("sesEmail.sendSliceSealForm", {
				mailArr: [creatorMailData],
			});
		}

		await t.commit();
		return {
			code: RESPONSES.status.success,
			message: RESPONSES.messages.success,
		};
	} catch (error) {
		console.log(error);
		await t.rollback();
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}

// Resend the Email to the mailed,viewed users
async function resendEmails(ctx) {
	const t = await sequelize.transaction();
	try {
		const formId = ctx.params.id;
		const companyId =
			ctx?.meta?.user?.company_id || ctx?.params?.company_id;

		const formDetails = await this.settings.models.pdfForms.findOne({
			where: {
				id: formId,
				company_id: companyId,
				status: {
					[Op.or]: ["pending", "expired"],
				},
			},
			include: [
				{
					model: this.settings.models.pdfFormRecipients,
					where: {
						// status: "pending",
						[Op.and]: [
							{ status: { [Op.ne]: "revoked" } },
							{
								[Op.or]: [
									{ status: "mailed" },
									{ status: "viewed" },
									{ status: "bounced" },
								],
							},
							{ role: "signer" },
						],
					},
					attributes: [
						"id",
						"company_id",
						"email",
						"token",
						"status",
						"name",
						"role",
					],
				},
				{
					model: this.settings.models.users,
					attributes: ["full_name", "email", "id"],
				},
				{
					model: this.settings.models.companies,
					attributes: ["name", "id"],
				},
			],
			attributes: ["id", "title", "company_id", "status"],
		});

		if (formDetails?.status === "expired") {
			await t.rollback();
			return {
				code: RESPONSES.status.error,
				message:
					"The document validity has expired. Please set a new expiry date to resend.",
			};
		}

		if (!formDetails) {
			await t.rollback();
			return {
				code: RESPONSES.status.error,
				message:
					"Document could not be resent, Please refresh the page",
			};
		}

		if (
			formDetails?.dataValues?.pdf_form_recipients?.every(
				(r) => r?.dataValues?.status === "bounced"
			)
		) {
			await t.rollback();
			return {
				code: RESPONSES.status.error,
				status: "bounced",
				message:
					"All users email has been Bounced. Please replace the users",
			};
		}
		// const formName = formDetails?.title;
		// const subject = "Form Request";
		const recipients = formDetails?.dataValues?.pdf_form_recipients?.filter(
			(r) => r?.dataValues?.status !== "bounced"
		);

		// If the form is protected then re generate the password for all users
		const emailArr = await Promise.all(
			recipients?.map(async (recipient) => {
				const mailData = await getEmailTemplateAndSendMail.call(
					this,
					formId,
					{
						name: recipient?.name,
						email: recipient?.email,
						token: recipient?.token,
						role: recipient?.role,
					},
					{
						title: formDetails?.title,
						user: {
							full_name: formDetails?.user?.full_name,
						},
						company: {
							name: formDetails?.company?.name,
							id: formDetails?.company?.id,
						},
					},
					"document_resend"
				);

				return mailData;
			})
		);

		// send the email
		// emailArr?.map((eObj) => {
		// this.sendEmail(eObj); // Node Mailer

		// });

		const mailArr = emailArr?.filter((r) => r !== undefined || r !== null);
		console.log(
			"**************** resend email recipients ***********************"
		);
		if (mailArr?.length > 0) {
			await this.settings.models.pdfFormHistory.create(
				{
					activity: "Document has been Resent",
					action: "resent",
					form_id: formId,
					company_id: companyId,
					performed_by: ctx?.meta?.user?.id,
				},
				{
					transaction: t,
				}
			);

			this.broker.call("sesEmail.sendSliceSealForm", {
				mailArr: mailArr,
				trackEvent: true,
			});
		}
		await t.commit();
		return {
			code: RESPONSES.status.success,
			message: RESPONSES.messages.success,
		};
	} catch (error) {
		console.log(error);
		await t.rollback();
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}

// Get all Activity History
async function activityHistory(ctx) {
	try {
		const page =
			parseInt(ctx.params.page ? ctx.params.page : undefined, 10) || 1;
		const limit =
			parseInt(ctx.params.limit ? ctx.params.limit : undefined, 10) ||
			Number(process.env.PAGE_LIMIT);
		const offset = (page - 1) * limit;
		const sortBy = ctx.params.sortBy ? ctx.params.sortBy : "createdAt";
		const order = ctx.params.order ? ctx.params.order : "DESC";
		const id = ctx?.params.id;
		const companyId =
			ctx?.meta?.user?.company_id || ctx?.params?.company_id;

		const whereCondition = {
			form_id: id,
			company_id: companyId,
		};

		const formDeclinedReason =
			await this.settings.models.pdfFormRecipients.findOne({
				where: {
					form_id: id,
					company_id: companyId,
					status: { [Op.ne]: "revoked" },
					reason_for_declining: { [Op.ne]: null },
				},
				attributes: ["reason_for_declining"],
			});

		const voidReason = await this.settings.models.pdfForms.findOne({
			where: {
				id,
				company_id: companyId,
			},
			attributes: ["void_reason"],
		});

		const formHistory = await this.settings.models.pdfFormHistory.findAll({
			where: whereCondition,
			include: [
				{
					model: this.settings.models.users,
				},
			],
			limit,
			order: [[sortBy, order]],
			offset: offset || null,
		});

		const totalRecords = await this.settings.models.pdfFormHistory.count({
			where: whereCondition,
		});

		return {
			code: RESPONSES.status.success,
			message: RESPONSES.messages.success,
			data: {
				formHistory,
				totalRecords,
				reason: {
					...formDeclinedReason?.dataValues,
					...voidReason?.dataValues,
				},
			},
		};
	} catch (error) {
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}

// Generate Template from form
async function saveToTemplate(ctx) {
	const t = await sequelize.transaction();
	try {
		const id = ctx.params.id;
		const companyId =
			ctx?.meta?.user?.company_id || ctx?.params?.company_id;

		// Fetch form details with related fields and recipients
		// need all attributes
		const formDetails = await this.settings.models.pdfForms.findOne({
			where: { id, company_id: companyId },
			include: [
				{
					model: this.settings.models.pdfFormFields,
					include: [
						{
							model: this.settings.models.pdfFieldsOptions,
						},
					],
				},
				{
					model: this.settings.models.pdfFormRecipients,
					where: {
						status: { [Op.ne]: "revoked" },
					},
				},
			],
		});

		if (!formDetails) {
			await t.rollback();
			console.log("Form not found.");
			return {
				code: RESPONSES.status.error,
				message: RESPONSES.messages.form_not_found,
			};
		}

		// lets find if any same name form exists or not
		const existingName = await this.settings.models.pdfForms.findOne({
			where: {
				title: formDetails.title,
				company_id: companyId,
				created_by: ctx?.meta?.user?.id || formDetails?.created_by,
				status: { [Op.ne]: "deleted" },
				is_template: true,
				id: { [Op.ne]: formDetails.id || id }, // Assuming you want to exclude a specific ID
			},
		});

		if (existingName) {
			await t.rollback();
			console.log("A Template with this name already exists.");
			return {
				code: RESPONSES.status.error,
				message: "A Template with this name already exists.",
			};
		}

		const newTemplateData = await this.copyObject(
			{
				file_url: formDetails?.form_original_url,
				key: formDetails?.form_original_key,
				file_name: formDetails?.title,
			},
			"SLICE HRMS/images/signify/templates/"
		);

		// Create template data
		const template = await this.settings.models.pdfFormFiles.create(
			{
				company_id: companyId,
				file_name: formDetails.title,
				file_url: newTemplateData.fileUrl,
				key: newTemplateData.key,
				created_by: ctx?.meta?.user?.id,
			},
			{
				transaction: t,
			}
		);

		// Create a new form
		const { id: _, ...formData } = formDetails.toJSON(); // Exclude 'id' field
		const newForm = await this.settings.models.pdfForms.create(
			{
				...formData,
				document_id: null,
				form_token: null,
				company_id: companyId,
				form_url: newTemplateData.fileUrl,
				form_original_url: newTemplateData.fileUrl,
				form_original_key: newTemplateData.key,
				key: newTemplateData.key,
				file_id: template.id,
				audit_log_file_url: null,
				combined_file_url: null,
				created_by: ctx?.meta?.user?.id,
				is_template: true,
				status: "pending",
				createdAt: new Date() || formData.updatedAt,
			},
			{
				transaction: t,
			}
		);

		const recipients = formDetails?.pdf_form_recipients;

		for (const recipient of recipients) {
			const { id: _, ...recipientData } = recipient.toJSON();

			const recipientFields = formDetails.pdf_form_fields.filter(
				(field) => field.form_recipient_id === recipient.id
			);
			const newRecipient =
				await this.settings.models.pdfFormRecipients.create(
					{
						...recipientData,
						form_id: newForm.id,
						status: "pending",
						viewedAt: null,
					},
					{
						transaction: t,
					}
				);

			for (const field of recipientFields) {
				const { id: _, ...fieldData } = field.toJSON(); // Exclude 'id'

				const newField =
					await this.settings.models.pdfFormFields.create(
						{
							...fieldData,
							form_id: newForm.id,
							form_recipient_id: newRecipient.id,
							uuid_field_id: uuidv4(),
						},
						{
							transaction: t,
						}
					);

				if (field.pdf_fields_options.length > 0) {
					const options = field.pdf_fields_options.map((option) => {
						const { id: _, ...optionData } = option.toJSON(); // Exclude 'id'
						return {
							...optionData,
							field_id: newField.id,
						};
					});
					await this.settings.models.pdfFieldsOptions.bulkCreate(
						options,
						{
							transaction: t,
						}
					);
				}
			}
		}
		// Create history for form creation
		await this.settings.models.pdfFormHistory.create(
			{
				activity: "Document has been Created",
				action: "mailed",
				form_id: newForm?.id,
				company_id: companyId,
				performed_by: ctx?.meta?.user?.id,
			},
			{
				transaction: t,
			}
		);
		await t.commit();
		return {
			code: RESPONSES.status.success,
			message: RESPONSES.messages.success,
		};
	} catch (error) {
		await t.rollback();
		console.error("Error in saveToTemplate:", error);
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}

//Check the Expiration Corn Job
async function checkExpiration(ctx) {
	const t = await sequelize.transaction();
	try {
		const currentDate = moment().utc().toDate();
		const forms = await this.settings.models.pdfForms.findAll({
			where: {
				expiration_date: {
					[Op.ne]: null,
					[Op.lt]: currentDate,
				},

				status: "pending",
			},
			include: [
				{
					model: this.settings.models.pdfFormRecipients,
					where: {
						[Op.and]: [
							{ status: { [Op.ne]: "revoked" } },
							{
								[Op.or]: [
									{ status: "mailed" },
									{ status: "viewed" },
									{ status: "pending" },
									{ status: "bounced" },
								],
							},
						],
					},
					attributes: ["id", "status"],
				},
				{
					model: this.settings.models.users,
				},
				{
					model: this.settings.models.companies,
					attributes: ["id", "name"],
				},
			],
		});

		if (Array.isArray(forms) && forms.length > 0) {
			await this.settings.models.pdfForms.update(
				{
					status: "expired",
				},
				{
					where: {
						id: { [Op.in]: forms?.map((f) => f?.id) },
					},
					transaction: t,
				}
			);

			await this.settings.models.pdfFormHistory.bulkCreate(
				forms.map((f) => ({
					activity: "Document has been Expired",
					action: "expired",
					form_id: f.id,
					performer_name: "System",
				})),
				{
					transaction: t,
				}
			);

			const mailData = await Promise.all(
				forms.map(async (f) => {
					const emailData = await getEmailTemplateAndSendMail.call(
						this,
						f.id,
						{
							name: f?.dataValues.user?.full_name,
							email: f?.dataValues?.user?.email,
						}, //f?.dataValues?.users,
						{
							title: f?.dataValues?.title,
							form_url: f?.dataValues?.form_url,
							user: {
								email: f?.dataValues?.user?.email,
								full_name: f?.dataValues?.user?.full_name,
							},
							company: {
								name: f?.dataValues?.company?.name,
								id: f?.dataValues?.company?.id,
							},
						},
						"document_link_expired"
					);
					return emailData;
				})
			);
			const mailArr = mailData?.filter(
				(r) => r !== undefined || r !== null
			);
			console.log(
				"**************** Check Expiration ***********************"
			);
			if (mailArr?.length > 0) {
				this.broker.call("sesEmail.sendSliceSealForm", {
					mailArr: mailArr,
				});
			}
		}
		await t.commit();
	} catch (error) {
		await t.rollback();
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}

// Delete file from S3 bucket
async function deleteFileFromS3(ctx) {
	const { fileKey } = ctx.params; // Destructure parameters
	const keysToDelete = [fileKey];

	try {
		await Promise.all(
			keysToDelete.map(async (key) => await this.fileDeleteFromS3(key))
		);

		return {
			code: RESPONSES.status.success,
			message: RESPONSES.messages.success,
		};
	} catch (error) {
		console.error("Error in deleteFileFromS3:", error); // Log the error
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}

// For Email Reminders
async function sendEmailReminder() {
	const t = await sequelize.transaction();
	try {
		// const companyData = await this.settings.models.companies.findAll({
		// 	attributes: ["id", "name"],
		// });

		// for (const company of companyData) {
		// 	const companyId = company.id;

		// Get reminder days from settings for this company
		const reminderSettings = await this.settings.models.settings.findOne({
			attributes: [
				"reminder_days",
				"validity_type",
				"date_format",
				"time_format",
			],
		});

		const reminderDays = reminderSettings?.dataValues?.reminder_days
			? parseInt(reminderSettings?.dataValues?.reminder_days)
			: null;

		// Skip this company if no reminder days set
		if (!reminderDays) {
			return;
		}

		// const currentDate = new Date();
		const currentDate = moment().utc().toDate();
		const forms = await this.settings.models.pdfForms.findAll({
			where: {
				// company_id: companyId,
				status: "pending",
				is_template: false,
			},
			include: [
				{
					model: this.settings.models.pdfFormRecipients,
					where: {
						[Op.and]: [
							{ status: { [Op.ne]: "revoked" } },
							{
								[Op.or]: [
									{ status: "mailed" },
									{ status: "viewed" },
									{ status: "pending" },
								],
							},
						],
					},
					attributes: ["id", "status", "email", "token", "name"],
				},
				{
					model: this.settings.models.users,
					attributes: ["id", "email", "full_name"],
				},
				{
					model: this.settings.models.companies,
					attributes: ["id", "name"],
				},
			],
		});
		const historyArr = [];
		if (forms?.length > 0) {
			for (const form of forms) {
				const { id: form_id, user } = form;

				const lastExecution =
					await this.settings.models.pdfFormReminderLogs.findOne({
						where: {
							company_id: form?.company_id,
							form_id,
						},
						order: [["execution_date", "DESC"]],
					});

				const lastExecutedDate = lastExecution?.execution_date || null;
				const sendZeroDayMail = lastExecutedDate === null;

				// const nextReminderDate = lastExecutedDate
				// 	? new Date(
				// 			new Date(lastExecutedDate).getTime() +
				// 				reminderDays * 24 * 60 * 60 * 1000
				// 	  )
				// 	: new Date(currentDate.getTime() - 1);

				const nextReminderDate = lastExecutedDate
					? moment
							.utc(lastExecutedDate)
							.add(reminderDays, "days")
							.toDate()
					: moment
							.utc(currentDate)
							.subtract(1, "millisecond")
							.toDate();

				if (nextReminderDate <= currentDate) {
					const recipients = form?.dataValues?.pdf_form_recipients;

					const emailArr = await Promise.all(
						recipients?.map(async (recipient) => {
							const formExpirationDate =
								form?.expiration_date &&
								moment(form.expiration_date).format(
									`${
										reminderSettings?.dataValues
											?.date_format
									} ${
										reminderSettings?.dataValues
											?.time_format === "12-Hours"
											? "hh:mm A"
											: "HH:mm"
									}`
								);

							const emailData =
								await getEmailTemplateAndSendMail.call(
									this,
									form_id,
									{
										name: recipient?.name,
										email: recipient?.email,
										token: recipient?.token,
									},
									{
										title: form?.title,
										expirationDate: formExpirationDate,
										user: {
											full_name: user?.full_name,
											email: user?.email,
										},
										company: {
											name: form?.dataValues?.company
												?.name,
											id: form?.company_id,
										},
									},
									"reminder_to_sign_document"
								);

							return emailData;
						})
					);
					console.log("is zero day email", sendZeroDayMail);
					if (!sendZeroDayMail) {
						const mailArr = emailArr?.filter(
							(r) => r !== undefined || r !== null
						);
						console.log(
							mailArr?.map((m) => {
								console.log(m?.recipient, "recipient");
								return m?.recipient; // Ensures map() returns an array of recipients
							}),
							"mailArr***"
						);
						historyArr.push({
							id: form_id,
							company_id: form?.company_id,
						});

						console.log(
							"**************** Reminder Email ***********************"
						);

						if (mailArr?.length > 0) {
							this.broker.call("sesEmail.sendSliceSealForm", {
								mailArr: mailArr,
							});
						}
					}

					await this.settings.models.pdfFormReminderLogs.create(
						{
							company_id: form?.company_id,
							form_id,
							execution_date: currentDate,
							status: "success",
						},
						{
							transaction: t,
						}
					);
				}
			}
		}

		await this.settings.models.pdfFormHistory.bulkCreate(
			historyArr?.map((f) => ({
				activity: "Reminder has been Sent",
				action: "reminded",
				form_id: f.id,
				company_id: f?.company_id,
				performer_name: "System",
			})),
			{
				transaction: t,
			}
		);
		// }
		await t.commit();
	} catch (error) {
		await t.rollback();
		console.log(error, "ERROR");
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}

async function addAuditLog(
	formDetailsCreator,
	formUrl,
	isPriorityRequired,
	formDetails,
	companyDetails,
	dir,
	localPath,
	isSignatureRequired,
	t = null,
	isSenderSide
) {
	try {
		// if it is parallel flow then we take pdfPath as pdfData
		let pdfData = isPriorityRequired ? null : formUrl;
		pdfData = isSenderSide ? null : pdfData;
		const pdfFormRecipientsEvents =
			await this.settings.models.pdfFormHistory.findAll({
				where: {
					form_id: formDetails?.id,
					company_id: companyDetails?.data?.id,
					[Op.not]: {
						action: ["mailed"],
					},
				},
				order: [["id", "ASC"]],
				transaction: t,
			});

		let auditLogFile;

		const response =
			(isPriorityRequired || isSenderSide) &&
			(await axios.get(formUrl, {
				responseType: "arraybuffer",
			}));

		const fileBuffer =
			(isPriorityRequired || isSenderSide) &&
			Buffer.from(response.data, "utf-8");

		const fileData =
			!isSenderSide &&
			!isPriorityRequired &&
			(await fs.promises.readFile(pdfData));

		const pdfDoc = await PDFDocument.load(
			isPriorityRequired || isSenderSide ? fileBuffer : fileData
		);

		const htmlFilePath = `./assets/${Date.now()}-${
			formDetails?.title
		}-html.pdf`;
		await createPDFFromHtml(
			formDetails,
			formDetailsCreator,
			pdfFormRecipientsEvents,
			htmlFilePath
		);

		const htmlPdfBytes = await fs.promises.readFile(htmlFilePath);

		htmlFilePath && fs.promises.unlink(htmlFilePath);

		// Step 3: Embed the HTML PDF into the existing PDF
		const htmlPdfDoc = await PDFDocument.load(htmlPdfBytes);

		const [htmlPage] = await pdfDoc.copyPages(htmlPdfDoc, [0]);

		// Add the rendered HTML page to the existing PDF
		pdfDoc.addPage(htmlPage);

		// Step 4: Save the modified PDF
		const modifiedPdfBytes = await pdfDoc.save();
		let file = {
			buffer: {
				data: modifiedPdfBytes,
			},
			size: modifiedPdfBytes.byteLength / 1024 / 1024,
			originalname: formDetails?.title,
			mimetype: "application/pdf",
		};
		//if signature required then return the filepath else upload the file to s3
		const uniqueTimeStamp = Date.now();
		const pdfResponse = isSignatureRequired
			? await writeFileOnLocal(
					{ params: { modifiedPdfBytes } },
					`${uniqueTimeStamp}-${formDetails?.title}-audit-log.pdf`,
					true
			  )
			: await this.directUpload(file, dir, companyDetails?.data?.name);

		if (formDetails?.attach_audit_log) {
			// if signature required
			if (isSignatureRequired) {
				// Sending Bytes

				pdfData && fs.promises.unlink(pdfData);

				return {
					combinedFilePath: pdfResponse?.filePath,
				};
			} else {
				// if priority required then delete the formUrl from s3
				isPriorityRequired &&
					(await this.fileDeleteFromS3(null, formUrl));

				return pdfResponse;
			}
		} else {
			// Create a new PDF document

			const newPdfDoc = await PDFDocument.create();

			const htmlPdfDoc = await PDFDocument.load(htmlPdfBytes);

			const [htmlPage] = await newPdfDoc.copyPages(htmlPdfDoc, [0]);

			newPdfDoc.addPage(htmlPage);

			const newPDFBytes = await newPdfDoc.save();
			let file = {
				buffer: {
					data: newPDFBytes,
				},
				size: newPDFBytes.byteLength / 1024 / 1024,
				originalname: `${formDetails?.title}-audit-log.pdf`,
				mimetype: "application/pdf",
			};
			const auditLogFileResponse =
				// if signature required then return the newPDFBytes else upload the file to s3
				await this.directUpload(file, dir, companyDetails?.data?.name);
			auditLogFile = auditLogFileResponse?.url;
			// if signature required then update the audit_log_file_url else  update the combined_file_url and audit_log_file_url
			if (isSignatureRequired) {
				formDetails.audit_log_file_url = auditLogFile;
				await formDetails.save({ transaction: t });
			} else {
				formDetails.combined_file_url = pdfResponse?.url;
				formDetails.audit_log_file_url = auditLogFile;
				await formDetails.save({ transaction: t });
			}

			// if signature required then return the combinedFileData and auditLogFileData else return the combinedFileUrl
			return isSignatureRequired
				? {
						combinedFilePath: pdfResponse?.filePath,
						// auditLogFileData:
						// 	auditLogFileResponse,
				  }
				: {
						combinedFileUrl: pdfResponse?.url,
				  };
		}
	} catch (error) {
		console.log(error, "ERROR");
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}

async function drawOnPDF(
	recipientsId,
	formDetails,
	filledData, // formFields
	companyDetails,
	dir,
	localPath,
	isSignatureRequired,
	recipientDetails,
	t
) {
	try {
		let formUrl = formDetails?.form_url;
		const devicePixelRatio = formDetails?.devicePixelRatio || 1;

		const currentFileVersion = await this.settings.models.pdfForms.findOne({
			where: {
				id: formDetails?.id,
				company_id: companyDetails?.data?.id,
			},
			attributes: ["version", "form_url"],
			transaction: t,
		});

		if (currentFileVersion?.version > formDetails?.version) {
			formUrl = currentFileVersion?.form_url || formUrl;
		}

		// const response = await axios.get(formUrl, {
		// 	responseType: "arraybuffer",
		// });
		const fileUniqueTimeStamp = Date.now();
		const filePath = `${localPath}/${fileUniqueTimeStamp}-${formDetails?.title}.pdf`;
		const response = await this.getFileAndWrite(null, filePath, formUrl);

		const fileData = await fs.promises.readFile(response?.filePath);

		// Read the file as a buffer in UTF-8 encoding because latter on we need to sign the file
		// const fileBuffer = Buffer.from(fileData, "utf-8"); // must use utf-8 encoding because later on we need to sign the file
		const pdfDoc = await PDFDocument.load(fileData);

		const pages = pdfDoc.getPages();

		const fieldIds = filledData.map((field) => field?.fieldId);

		const formFieldsData = await this.settings.models.pdfFormFields.findAll(
			{
				where: {
					uuid_field_id: fieldIds,

					form_recipient_id: recipientsId,
					company_id: companyDetails?.data?.id ?? null,
				},
				include: [
					{
						model: this.settings.models.pdfFieldsOptions,
						attributes: ["id", "label"],
					},
					{
						model: this.settings.models.pdfFormRadioButtons,
					},
				],
				// transaction: t,
				attributes: [
					"id",
					"company_id",
					"form_id",
					"form_recipient_id",
					"field_label",
					"type",
					"status",
					"field_order",
					"x_coordinate",
					"y_coordinate",
					"height",
					"width",
					"zoom_x",
					"zoom_y",
					"scale_x",
					"scale_y",
					"pageIndex",
					"font_family",
					"selected_option",
					"uuid_field_id",
				],
			}
		);

		// Create lookup map for faster access
		const formFieldsMap = formFieldsData.reduce((acc, field) => {
			acc[field.uuid_field_id] = field;
			return acc;
		}, {});

		// Map filled data with form fields data
		const filledDataInfo = filledData.map((field) => {
			const data = formFieldsMap[field.fieldId];

			if (!data) {
				return { ...field };
			}

			return {
				...data.toJSON(),
				...field,
				field_Data: field?.fieldData,
				selected_option: field?.selectedOption,
			};
		});

		// Signature file check
		let signImgFile;
		let initialFile;

		// Helper function to draw text on page
		const drawText = (text, object, page, pageHeight, font = undefined) => {
			// Initial position and configuration
			const margin = 40;
			const rightMargin = 5;
			const bottomMargin = 0;
			const zoomLevel = 1.75;
			let x = object?.x_coordinate / zoomLevel + rightMargin;
			const textSize =
				object?.font_size ||
				(object?.height * object?.scale_y) / (2 * zoomLevel);
			let y =
				(pageHeight * zoomLevel -
					object?.y_coordinate -
					(object?.height * object?.scale_y + textSize) / 2) /
					zoomLevel +
				bottomMargin;

			// Check if it's a textarea field
			if (object?.rows > 1) {
				// For textarea fields with fixed dimensions
				const boxWidth = (object?.width * object?.scale_x) / zoomLevel;
				const boxHeight =
					(object?.height * object?.scale_y) / zoomLevel;
				const lineHeight = textSize + 5; // Slightly reduced line spacing for textarea
				const maxLines = Math.floor(boxHeight / lineHeight);

				// Calculate available width for text (account for padding)
				const paddingX = 5;
				const effectiveWidth = boxWidth - paddingX * 2;

				// Split text into words
				const words = text.split(/\s+/);
				let lines = [];
				let currentLine = [];
				let currentWidth = 0;

				// Helper function to measure text width accurately
				const measureText = (text) => {
					if (!font || !text) return 0;
					return font.widthOfTextAtSize(text, textSize);
				};

				// Process each word to fit within textarea width
				words.forEach((word) => {
					const wordWidth = measureText(word);
					const spaceWidth = measureText(" ");

					// Check if adding this word exceeds the effectiveWidth
					if (
						currentWidth + spaceWidth + wordWidth <=
							effectiveWidth ||
						currentLine.length === 0
					) {
						// Word fits on current line
						currentLine.push(word);
						currentWidth =
							currentWidth +
							(currentLine.length > 1 ? spaceWidth : 0) +
							wordWidth;
					} else {
						// Start a new line
						if (currentLine.length > 0) {
							lines.push(currentLine.join(" "));
						}

						// Handle words that are longer than effectiveWidth
						if (wordWidth > effectiveWidth) {
							let remainingWord = word;
							while (remainingWord) {
								let i = 1;
								let chunk = remainingWord[0];

								// Find maximum characters that fit
								while (i < remainingWord.length) {
									const testChunk = chunk + remainingWord[i];
									if (
										measureText(testChunk) <= effectiveWidth
									) {
										chunk = testChunk;
										i++;
									} else {
										break;
									}
								}

								lines.push(chunk);
								remainingWord = remainingWord.slice(i);
							}
							currentLine = [];
							currentWidth = 0;
						} else {
							currentLine = [word];
							currentWidth = wordWidth;
						}
					}
				});

				// Add the last line if there's anything remaining
				if (currentLine.length > 0) {
					lines.push(currentLine.join(" "));
				}

				// Limit to maximum number of lines that can fit in the textarea
				if (lines.length > maxLines) {
					lines = lines.slice(0, maxLines);
				}

				// Adjust vertical alignment to start from top of the textarea
				const startY = y + boxHeight / 2 - textSize;

				// Draw each line in the textarea
				lines.forEach((line, index) => {
					page.drawText(line, {
						x: x + paddingX,
						y: startY - index * lineHeight,
						size: textSize,
						font,
					});
				});
			} else {
				// Original logic for input fields
				// Calculate available width for text
				const maxWidth = page?.getWidth() - x - rightMargin;

				// Helper function to measure text width accurately
				const measureText = (text) => {
					if (!font || !text) return 0;
					return font.widthOfTextAtSize(text, textSize);
				};

				// Check if text contains any whitespace
				const hasWhitespace = /\s/.test(text);

				if (hasWhitespace) {
					// Process text with whitespace (existing logic)
					const words = text.split(/\s+/);
					let lines = [];
					let currentLine = [];
					let currentWidth = 0;

					// Process each word
					words.forEach((word) => {
						const wordWidth = measureText(word);
						const spaceWidth = measureText(" ");

						// Check if adding this word exceeds the maxWidth
						if (
							currentWidth + spaceWidth + wordWidth <= maxWidth ||
							currentLine.length === 0
						) {
							// Word fits on current line
							currentLine.push(word);
							currentWidth =
								currentWidth +
								(currentLine.length > 1 ? spaceWidth : 0) +
								wordWidth;
						} else {
							// Start a new line
							if (currentLine.length > 0) {
								lines.push(currentLine.join(" "));
							}

							// Handle words that are longer than maxWidth
							if (wordWidth > maxWidth) {
								let remainingWord = word;
								while (remainingWord) {
									let i = 1;
									let chunk = remainingWord[0];

									// Find maximum characters that fit
									while (i < remainingWord.length) {
										const testChunk =
											chunk + remainingWord[i];
										if (
											measureText(testChunk) <= maxWidth
										) {
											chunk = testChunk;
											i++;
										} else {
											break;
										}
									}

									lines.push(chunk);
									remainingWord = remainingWord.slice(i);
								}
								currentLine = [];
								currentWidth = 0;
							} else {
								currentLine = [word];
								currentWidth = wordWidth;
							}
						}
					});

					// Add the last line if there's anything remaining
					if (currentLine.length > 0) {
						lines.push(currentLine.join(" "));
					}

					// Draw the lines
					drawLines(lines);
				} else {
					// Handle text without whitespace (character by character if needed)
					if (measureText(text) <= maxWidth) {
						// Text fits in one line
						page.drawText(text, {
							x,
							y,
							size: textSize,
							font,
						});
					} else {
						// Text needs to be broken into chunks
						let lines = [];
						let remainingText = text;

						while (remainingText) {
							let i = 1;
							let chunk = remainingText[0];

							// Find maximum characters that fit in one line
							while (i < remainingText.length) {
								const testChunk = chunk + remainingText[i];
								if (measureText(testChunk) <= maxWidth) {
									chunk = testChunk;
									i++;
								} else {
									break;
								}
							}

							lines.push(chunk);
							remainingText = remainingText.slice(i);
						}

						// Draw the lines
						drawLines(lines);
					}
				}
			}

			// Helper function to draw lines with proper spacing
			function drawLines(lines) {
				const lineHeight = textSize + 5;
				const totalHeight = lines.length * lineHeight;

				// Adjust for available vertical space
				const bottomY = y - totalHeight;
				if (bottomY < margin) {
					const availableLines = Math.floor(
						(y - margin) / lineHeight
					);
					lines = lines.slice(0, Math.max(0, availableLines));
				}

				// Draw each line
				lines.forEach((line, index) => {
					const lineY = y - index * lineHeight;
					if (lineY >= margin) {
						page.drawText(line, {
							x,
							y: lineY,
							size: textSize,
							font,
						});
					}
				});
			}
		};

		for (let i = 0; i < filledDataInfo.length; i++) {
			const object = filledDataInfo[i];
			const page = pages[object?.pageIndex || 0];
			const pageHeight = page.getHeight();

			const fieldValue = object?.field_Data;

			if (object?.type === "dropdown") {
				const optionLabel = object.pdf_fields_options?.find(
					(option) => option?.id === object?.selected_option
				)?.label;

				if (optionLabel) {
					drawText(optionLabel, object, page, pageHeight);
				}
			} else if (
				object?.type === "text" ||
				object.type === "date" ||
				object?.type === "full_name" ||
				object?.type === "email_id" ||
				object?.type === "company" ||
				object?.type === "title" ||
				object?.type === "number" ||
				object?.type === "signed_date"
			) {
				if (fieldValue) {
					let font;
					switch (object?.font_family) {
						case "Arial":
							font = await embedFont("Arial", pdfDoc);
							break;
						case "Calibri":
							font = await embedFont("Calibri", pdfDoc);
							break;
						case "Times-Roman":
							font = await embedFont("Times-Roman", pdfDoc);
							break;
						case "Verdana":
							font = await embedFont("Verdana", pdfDoc);
							break;
						case "Courier":
							font = await embedFont("Courier", pdfDoc);
							break;
						case "Georgia":
							font = await embedFont("Georgia", pdfDoc);
							break;
						default:
							font = await pdfDoc.embedFont(
								StandardFonts.Helvetica
							);
							break;
					}
					drawText(fieldValue, object, page, pageHeight, font);
				}
			} else if (object?.type === "checkbox") {
				if (fieldValue) {
					const svgPaths = {
						checkbox:
							"M21.03 5.72a.75.75 0 0 1 0 1.06l-11.5 11.5a.747.747 0 0 1-1.072-.012l-5.5-5.75a.75.75 0 1 1 1.084-1.036l4.97 5.195L19.97 5.72a.75.75 0 0 1 1.06 0Z",
					};

					page.drawSvgPath(svgPaths[object?.type], {
						x: object?.x_coordinate / 1.75,
						y: (pageHeight * 1.75 - object?.y_coordinate) / 1.75,
						color: rgb(0, 0, 0),
						scale: object?.scale_x / (1.75 * devicePixelRatio), // Adjust scale as necessary
						borderWidth: 0,
					});
				}
			} else if (object?.type === "radio") {
				if (fieldValue) {
					const svgPaths = {
						radio: "M12.5 0C5.55 0 0 5.55 0 12.5S5.55 25 12.5 25 25 19.45 25 12.5 19.45 0 12.5 0z",
					};
					const selectedOption = object?.pdf_form_radio_buttons?.find(
						(item) => item?.id === fieldValue
					);
					if (selectedOption) {
						page.drawSvgPath(svgPaths[object?.type], {
							x: selectedOption?.x_coordinate / 1.75,
							y:
								(pageHeight * 1.75 -
									selectedOption?.y_coordinate) /
								1.75,
							color: rgb(0, 0, 0),
							scale: object?.scale_x / (1.75 * devicePixelRatio),
							borderWidth: 0,
						});
					}
				}
			} else if (
				object?.type === "digital signature" ||
				object?.type === "initial"
			) {
				if (fieldValue) {
					const height = (object?.height * object?.zoom_y) / 2;
					let filePath;

					const isInitial = object?.type === "initial";
					const fileLabel = isInitial
						? "initials-image.png"
						: "signed-image.png";

					// Determine file path only if required and not already assigned
					if (isSignatureRequired) {
						if (
							(isInitial && !initialFile) ||
							(!isInitial && !signImgFile)
						) {
							const fileData = await this.getFileAndWrite(
								"",
								`${fileUniqueTimeStamp}-${fileLabel}`,
								object?.fieldData
							);
							filePath = fileData?.filePath;

							if (isInitial) {
								initialFile = filePath;
							} else {
								signImgFile = filePath;
							}
						} else {
							filePath = isInitial ? initialFile : signImgFile;
						}
					}

					if (filePath) {
						const ext = fieldValue.split(".").pop();
						const signatureData = await fs.promises.readFile(
							filePath
						);

						const img =
							ext === "png"
								? await pdfDoc.embedPng(signatureData)
								: await pdfDoc.embedJpg(signatureData);

						// Maintain aspect ratio
						const aspectRatio = img.width / img.height;
						const calculatedWidth = height * aspectRatio;

						page.drawImage(img, {
							x: object?.x_coordinate / 1.75,
							y:
								(pageHeight * 1.75 -
									object?.y_coordinate -
									height * 2) /
								1.75,
							width: calculatedWidth,
							height,
							blendMode: "Multiply",
						});
					}
				}
			}
		}

		// Save the updated PDF document
		const pdfBytes = await pdfDoc.save();

		await fs.promises.writeFile(filePath, pdfBytes);

		if (isSignatureRequired && (signImgFile || initialFile)) {
			try {
				signImgFile && (await fs.promises.unlink(signImgFile));
				initialFile && (await fs.promises.unlink(initialFile));
			} catch (err) {
				console.error("Error deleting signature file:", err);
			}
		}

		// Handle PDF upload or further processing

		const filledFile = await this.directUpload(
			{
				buffer: { data: pdfBytes },
				size: pdfBytes.byteLength / 1024 / 1024,
				originalname: formDetails?.title,
				mimetype: "application/pdf",
			},
			dir,
			companyDetails?.data?.name
		);
		// return filledFile?.url;
		const filledFileUrl = filledFile?.url;
		return { filePath, filledFileUrl };
	} catch (error) {
		console.error("Error processing PDF:", error);
		return {
			code: "error",
			message: "Internal Server error",
		};
	}
}

async function embedFont(fontName, pdfDoc) {
	const fontPath = path.resolve(`./assets/fonts/${fontName}.ttf`);
	const fontBytes = fs.readFileSync(fontPath);
	pdfDoc.registerFontkit(fontkit);
	return await pdfDoc.embedFont(fontBytes);
}

async function writeFileOnLocal(ctx, filename, returnBuffer = false) {
	try {
		const uploadDir = "./assets";
		const uniqueName = Date.now().toString();

		const { filePath, fileSize, fileBuffer } = await new this.Promise(
			(resolve, reject) => {
				const filePath = path.join(
					uploadDir,
					`${uniqueName}.${filename}`
				);

				// Handle Uint8Array data
				if (ctx.params.modifiedPdfBytes) {
					fs.writeFile(
						filePath,
						Buffer.from(ctx.params.modifiedPdfBytes),
						(err) => {
							if (err) {
								reject(err);
								return;
							}
							fs.promises
								.stat(filePath)
								.then((stats) => {
									resolve({
										filePath,
										fileSize: stats.size,
									});
								})
								.catch(reject);
						}
					);
					return;
				}

				// Handle stream data
				const f = fs.createWriteStream(filePath);
				f.on("finish", async () => {
					try {
						const stats = await fs.promises.stat(filePath);
						console.log(`Uploaded file stored in '${filePath}'`);
						resolve({
							filePath,
							fileSize: stats.size,
						});
					} catch (err) {
						reject(err);
					}
				});

				f.on("error", async (err) => {
					await fs.promises.unlink(filePath).catch(() => {});
					reject(err);
				});

				ctx.params.pipe(f);
			}
		);

		return returnBuffer
			? { filePath, fileSize, fileBuffer }
			: { filePath, fileSize };
	} catch (error) {
		console.log(error, "ERROR");
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}

async function checkIfTemplateExists(ctx) {
	try {
		const title = ctx?.params?.title;
		const companyId = ctx?.params?.companyId || ctx?.meta?.user?.company_id;
		const is_template = ctx?.params?.isTemplate;
		const id = ctx?.params?.id;

		const existingTemplate = await this.settings.models.pdfForms.findOne({
			where: {
				title: title,
				company_id: companyId,
				is_template,
				...(id ? { id: { [Op.ne]: id } } : {}),
				status: { [Op.ne]: "deleted" },
				file_id: { [Op.ne]: null },
				created_by: ctx?.meta?.user?.id,
			},
		});
		if (existingTemplate) {
			return {
				code: 409,
				message: "Template with this title already exists",
			};
		} else {
			return {
				code: 200,
				message: RESPONSES.messages.success,
			};
		}
	} catch (error) {
		console.log(error, "ERROR");
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}

async function addFormTags(ctx) {
	try {
		let tag = ctx.params.tag_name;

		//if tags already exists then we skip that tag
		let tagExists = await this.settings.models.pdfTags.findOne({
			where: {
				tag_name: tag,
				company_id:
					ctx?.meta?.user?.company_id || ctx?.params?.company_id,
			},
			attributes: ["id", "tag_name", "company_id"],
		});

		if (tagExists) {
			return {
				code: RESPONSES.status.exist,
				message: "Tag Name Already Exists",
			};
		}

		let tagData = await this.settings.models.pdfTags.create({
			tag_name: tag,
			company_id: ctx?.meta?.user?.company_id || ctx?.params?.company_id,
			user_id: ctx?.meta?.user?.id,
		});

		return {
			code: RESPONSES.status.success,
			message: RESPONSES.messages.success,
			data: tagData,
		};
	} catch (error) {
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
			error: error.message,
		};
	}
}

async function getAllTags(ctx) {
	try {
		//get all tags
		let formTags = await this.settings.models.pdfTags.findAll({
			where: {
				company_id:
					ctx?.meta?.user?.company_id || ctx?.params?.company_id,
			},
			attributes: ["id", "tag_name", "company_id"],
		});

		return {
			code: RESPONSES.status.success,
			message: RESPONSES.messages.success,
			data: formTags,
		};
	} catch (error) {
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
			error: error.message,
		};
	}
}

async function createPDFFromHtml(
	formDetails,
	formDetailsCreator,
	pdfFormRecipientsEvents,
	filePath
) {
	try {
		if (process.platform === "win32") {
			const wkhtmltopdfPath = `"${process.env.WKHTML_WIN_PATH}"`; // Wrapped in quotes
			if (!fs.existsSync(wkhtmltopdfPath.replace(/"/g, ""))) {
				// Remove quotes for fs.existsSync check
				console.log(`wkhtmltopdf.exe not found at ${wkhtmltopdfPath}`);
			}
			wkhtmltopdf.command = wkhtmltopdfPath;
		} else if (process.platform === "linux") {
			const wkhtmltopdfPath = process.env.WKHTML_LINUX_PATH; // Wrapped in quotes
			if (!fs.existsSync(wkhtmltopdfPath)) {
				// Remove quotes for fs.existsSync check
				console.log(`wkhtmltopdf not found at ${wkhtmltopdfPath}`);
			}
			wkhtmltopdf.command = wkhtmltopdfPath;
		}
		let sentOn;
		if (
			formDetails?.createdAt &&
			!isNaN(new Date(formDetails.createdAt).getTime()) &&
			formDetails.createdAt !== "CURRENT_TIMESTAMP"
		) {
			sentOn = formDetails.createdAt;
		} else {
			sentOn = new Date();
		}

		const sentOnStr = sentOn.toString();
		return new Promise((resolve, reject) => {
			const pdfStream = fs.createWriteStream(filePath);

			wkhtmltopdf(
				`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Audit Log</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
body {
font-family: 'Poppins', sans-serif;
margin: 0;
padding: 0;
}

header {
display: -webkit-box;
display: flex;
-webkit-box-align: center;
-webkit-align-items: center;
align-items: center; 
-webkit-box-pack: justify;
-webkit-justify-content: space-between;
justify-content: space-between; 
padding: 20px 20px 10px 20px;
background: white;
border-bottom: 3px solid #e5e7eb;
box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
}

.logo img {
height: 50px;
width: auto;
}

.header-title {
font-family: 'Poppins', sans-serif;
font-size: 20px;
font-weight: 600;
color: #374151;
}

.container {
/*max-width: 1200px;*/
margin: 10px auto;
padding: 0px 20px 10px 20px;
background: white;
/*box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);*/
}

.details {
display: -webkit-flex;
display: -webkit-box;
display: flex;
-webkit-flex-wrap: wrap;
flex-wrap: wrap;
-webkit-box-pack: start;
-webkit-justify-content: flex-start;
justify-content: flex-start;
gap: 30px;
row-gap: 10px;
padding: 10px 14px;
border: 2px solid #e5e7eb;
border-radius: 8px;
margin-bottom: 6px;
background: #f9fafb;
}

.details-item {
width: 45%;
min-width: 200px;
display: inline-block;
vertical-align: top;
color: #374151;
font-size: 14px;
}

.details-item strong {
font-size: 14px;
color: #6b7280;
}

.audit-table {
width: 100%;
border-collapse: collapse;
}

.audit-table thead th {
background-color: #1f2937;
color: white;
text-align: left;
padding: 6px;
font-size: 14px;
}

.audit-table tbody td {
border-bottom: 1px solid #e5e7eb;
padding: 6px;
font-size: 12px;
color: #374151;
}

.audit-table tbody tr:nth-child(even) {
background-color: #f9fafb;
}

.event-details {
font-size: 12px;
padding: 6px 10px;
color: #374151;
}

.event-details strong {
color: #1f2937;
}
</style>
</head>
<body>
<header>
<div class="logo">
<img src="https://devecs.slicehr.com/static/media/slice_logo_v1%20(1).53aec5b8af82a6220b78735622906aed.svg" alt="Company Logo">
</div>
<div class="header-title">Audit Log</div>
</header>
<div class="container">
<h4>Document Details</h4>
<div class="details">
<div class="details-item">
<strong>Document Name:</strong> ${formDetails?.title}
</div>
<div class="details-item">
<strong>Document ID:</strong>  ${formDetails?.document_id}
</div>
<div class="details-item">
<strong>Status:</strong> Completed
</div>
<div class="details-item">
<strong>Created By:</strong>${formDetailsCreator?.full_name}( ${
					formDetailsCreator?.email
				} )
</div>
<div class="details-item">
<strong>Sent On:</strong>  ${sentOnStr}
</div>
</div>
<h4>Timeline View</h4>

<table class="audit-table">
<thead>
<tr>
  <th>Timestamp</th>
  <th>Event</th>
  <th>Performed By</th>
  <th>Details</th>
</tr>
</thead>
<tbody>
${pdfFormRecipientsEvents
	?.map((event) => {
		return `
      <tr>
        <td>${event?.createdAt}</td>
        <td>${
			event?.action === "mailed"
				? `Email${event?.action}`
				: `Document ${event?.action}`
		} </td>
        <td>${event?.performer_name}</td>
        <td>
          <div class="event-details">
            <strong>IP Address:</strong> - ${event?.ip}<br>
            <strong>Device/Browser Details:</strong> - ${event?.browser}<br>
          </div>
        </td>
      </tr>`;
	})
	.join("")}
</tbody>
</table>
</body>
</html>`,
				{
					logLevel: "error",
					pageSize: "A4",
					marginTop: 0,
					marginLeft: 0,
					marginBottom: 0,
					marginRight: 0,
					// orientation: "portrait",
					spawnOptions: { shell: true },
				}
			)
				.on("error", (err) => {
					console.error("wkhtmltopdf error:", err);
					reject(new Error("PDF generation failed: " + err.message));
				})
				.pipe(pdfStream);

			pdfStream.on("finish", () => {
				console.log("PDF created successfully!");
				resolve();
			});

			pdfStream.on("error", (err) => {
				console.error("File write error:", err);
				reject(new Error("Failed to write PDF file: " + err.message));
			});
		});
	} catch (error) {
		console.error("Error creating PDF:", error);
		return {
			code: 500,
			message: "Internal Server Error",
			error: error.message,
		};
	}
}

async function getEmailTemplateAndSendMail(
	formId,
	recipientDetails,
	formDetails,
	type = "document_sign_request",
	isFirstRecipient,
	emailSubject = "",
	emailTemplate = "",
	reason
) {
	try {
		let finalTemplate = "";
		// First get the email type and its slugs
		const emailType =
			await this.settings.models.sliceSealEmailTypes.findOne({
				where: {
					label_key: type,
				},
				attributes: ["id", "email_slugs"],
			});

		if (!emailType) {
			// throw new Error(`No email type found for: ${type}`);
			console.log(`No email type found for: ${type}`);
			return;
		}

		// Need to check if flow is sequential and 1st user then skip condition else find template and slugs

		if (!(type === "document_sign_request" && isFirstRecipient)) {
			// Get custom email template from pdfForms
			const formEmailTemplate =
				await this.settings.models.pdfForms.findOne({
					where: {
						id: formId,
					},
					attributes: ["email_template", "email_subject"],
				});

			// Get default template if no custom template exists
			emailTemplate = formEmailTemplate?.email_template;
			emailSubject = formEmailTemplate?.email_subject;
			if (!emailTemplate || type !== "document_sign_request") {
				const defaultTemplate =
					await this.settings.models.sliceSealEmailTemplates.findOne({
						where: {
							email_type: emailType?.id,
						},
						attributes: ["email_template", "mail_subject"],
					});
				emailTemplate = defaultTemplate?.email_template;
				emailSubject = defaultTemplate?.mail_subject;
			}

			if (!emailTemplate) {
				// throw new Error("No email template found");
				console.log("No email template found");
				return;
			}
		}
		// // Parse email slugs from emailType
		// const availableSlugs = JSON.parse(
		// 	emailType?.email_slugs || "[]"
		// );
		const availableSlugs = emailType?.email_slugs?.map(
			(data) => data?.value
		);

		// Create mapping of slug values
		finalTemplate = emailTemplate;
		const slugValues = {
			"${recipient_name}": recipientDetails?.name,
			"${recipient_email}": recipientDetails?.email,
			"${recipient_status}": recipientDetails?.status,
			"${document_name}": formDetails?.title,
			"${bounce_email}": recipientDetails?.bounce_email,
			"${sender_name}": formDetails?.user?.full_name,
			"${sender_email}": formDetails?.user?.email,
			"${company_name}": formDetails?.company?.name,
			"${signature_link}": formDetails?.formUrl
				? formDetails?.formUrl
				: `${process.env.CLIENT_URL}/pdf-form?token=${
						formDetails?.token ?? recipientDetails?.token
				  }`, // form token changes
			"${reason_for_deletion}": reason,
			"${reason_for_void}": reason,
			"${declining_recipient_name}": recipientDetails?.declinedBy,
			"${reason_for_decline}": reason,
			"${user_name}": recipientDetails?.name,
			"${expiration_date}": formDetails?.expirationDate,
			// Add more mappings as needed
		};

		// console.log("EMAIL TEMPLATE", finalTemplate);

		// Replace each available slug with its corresponding value
		availableSlugs.forEach((slug) => {
			const value = slugValues[slug] || "";
			finalTemplate = finalTemplate.replace(
				new RegExp(`\\${slug}`, "g"),
				value
			);
			emailSubject = emailSubject.replace(
				new RegExp(`\\${slug}`, "g"),
				value
			);
		});

		const template = generateEmailTemplate(type, finalTemplate, slugValues);
		// const imagePath = path.join(
		// 	__dirname,
		// 	"../../email/slice_logo_v1 (1).png"
		// );
		// const iconPath = path.join(
		// 	__dirname,
		// 	this.getActionIconPath(type)
		// );

		/*******************Send with Node Mailer*******************/

		// const mailOptions = {
		// 	from: `"${formDetails?.user?.full_name}" ${process.env.EMAIL} `,
		// 	to: recipientDetails?.email,
		// 	subject: emailSubject,
		// 	html: template,
		// 	attachments: [
		// 		{
		// 			filename: "Company Logo.png",
		// 			path: imagePath,
		// 			cid: "company-logo",
		// 			//mimeType: "image/png",
		// 		},
		// 		{
		// 			filename: "Action.png",
		// 			path: iconPath,
		// 			cid: "action-icon",
		// 			//mimeType: "image/png",
		// 		},
		// 	],
		// };

		// return mailOptions;
		/********************** */
		/*************************Send with SES ************************* */
		return {
			formId: formId,
			companyId: formDetails?.company?.id,
			senderName: formDetails?.user?.full_name,
			recipient: recipientDetails?.email,
			subject: emailSubject,
			mailBody: template,
			role: recipientDetails?.role,
		};
	} catch (error) {
		console.error("Error in getEmailTemplateAndSendMail:", error);
		// throw error;
	}
}

function generateEmailTemplate(type, dynamicContent, slugValues) {
	let htmlContent = documentTemplate(type, dynamicContent);

	const availableSlugs = ["${document_name}", "${signature_link}"];
	// Replace each available slug with its corresponding value
	availableSlugs.forEach((slug) => {
		const value = slugValues[slug] || "";
		htmlContent = htmlContent.replace(new RegExp(`\\${slug}`, "g"), value);
	});
	return htmlContent;
}

async function declineForm(ctx) {
	const t = await sequelize.transaction();
	try {
		const { token, reason_for_declining } = ctx.params;
		const recipientDetails =
			await this.settings.models.pdfFormRecipients.findOne({
				where: {
					token,
					status: { [Op.notIn]: ["revoked"] },
				},
				include: [
					{
						model: this.settings.models.pdfForms,
						include: [
							{
								model: this.settings.models.users,
								attributes: ["id", "full_name", "email"],
							},
							{
								model: this.settings.models.companies,
								attributes: ["id", "name"],
							},
							{
								model: this.settings.models.pdfFormRecipients,
								where: {
									status: { [Op.ne]: "revoked" },
								},
								attributes: ["id", "name", "email", "status"],
							},
						],
					},
					{
						model: this.settings.models.users,
						attributes: ["id", "full_name", "email"],
					},
				],
			});

		if (
			recipientDetails?.dataValues?.pdf_form?.dataValues?.status ===
			"completed"
		) {
			await t.rollback();
			return {
				code: RESPONSES.status.error,
				message:
					"This document has already been completed and cannot be declined.",
			};
		}

		if (!recipientDetails) {
			await t.rollback();
			return {
				code: RESPONSES.status.error,
				message: "No recipient data found",
			};
		}
		if (recipientDetails?.is_changed) {
			await t.rollback();
			return {
				code: RESPONSES.status.error,
				message:
					"The document has been updated by the sender. Please refresh the page and try again.",
			};
		}
		if (
			recipientDetails?.dataValues?.pdf_form?.dataValues?.status ===
			"declined"
		) {
			const allRecipients =
				await this.settings.models.pdfFormRecipients.findAll({
					where: {
						form_id: recipientDetails?.dataValues?.pdf_form?.id,
						// status: { [Op.ne]: "revoked" },
					},
					attributes: ["id", "name", "email", "is_declined"],
				});

			const declinedRecipient = allRecipients.find(
				(recipient) => recipient.is_declined
			);
			if (declinedRecipient) {
				await t.rollback();
				return {
					code: RESPONSES.status.error,
					message: `This document has been declined by ${
						declinedRecipient?.name || declinedRecipient?.email
					} and is no longer available.`,
				};
			}
		} else if (
			recipientDetails?.dataValues?.pdf_form?.dataValues?.status ===
			"voided"
		) {
			await t.rollback();
			return {
				code: RESPONSES.status.error,
				message:
					"The document has been voided by the sender and is no longer valid.",
			};
		} else if (
			recipientDetails?.dataValues?.pdf_form?.dataValues?.status ===
			"deleted"
		) {
			await t.rollback();
			return {
				code: RESPONSES.status.error,
				message:
					"The document has been deleted by the sender and is no longer available.",
			};
		}

		await this.settings.models.pdfFormRecipients.update(
			{
				is_declined: true,
				reason_for_declining,
			},
			{
				where: {
					token,
				},
				transaction: t,
			}
		);

		await this.settings.models.pdfForms.update(
			{
				status: "declined",
			},
			{
				where: {
					id: recipientDetails?.dataValues?.pdf_form?.id,
				},
				transaction: t,
			}
		);

		const mailData = await getEmailTemplateAndSendMail.call(
			this,
			recipientDetails?.dataValues?.pdf_form?.id,
			{
				declinedBy: recipientDetails?.name,
				email: recipientDetails?.dataValues?.pdf_form?.dataValues?.user
					?.dataValues?.email,
				name: recipientDetails?.dataValues?.pdf_form?.dataValues?.user
					?.dataValues?.full_name,
			},
			{
				title: recipientDetails?.dataValues?.pdf_form?.title,
				user: {
					full_name:
						recipientDetails?.dataValues?.pdf_form?.dataValues?.user
							?.dataValues?.full_name,
					email: recipientDetails?.dataValues?.pdf_form?.dataValues
						?.user?.dataValues?.email,
				},
				company: {
					name: recipientDetails?.dataValues?.pdf_form?.dataValues
						?.company?.dataValues?.name,
					id: recipientDetails?.dataValues?.pdf_form?.dataValues
						?.company?.dataValues?.id,
				},
			},
			"document_declined_by_recipient",
			false,
			"",
			"",
			reason_for_declining
		);

		await this.settings.models.pdfFormHistory.create(
			{
				company_id:
					recipientDetails?.dataValues?.pdf_form?.dataValues?.company
						?.dataValues?.id,
				activity: "Document has been Declined",
				action: "declined",
				form_id: recipientDetails?.dataValues?.pdf_form?.id,
				performed_by:
					recipientDetails?.dataValues?.user?.dataValues?.id,
				performer_name: recipientDetails?.name,
				performer_color: recipientDetails?.color,
			},
			{
				transaction: t,
			}
		);

		// this.sendEmail(mailData); // Node mailer
		console.log(
			"**************** declined Form to sender ***********************"
		);
		if (mailData) {
			// this.broker.call("sesEmail.sendSliceSealForm", {
			// 	mailArr: [mailData],
			// });
			ctx.call("sesEmail.sendSliceSealForm", {
				mailArr: [mailData],
			});
		}

		// we sending email to changed recipients which are revoked
		const recipientEmailArr = await Promise.all(
			recipientDetails?.dataValues?.pdf_form?.dataValues?.pdf_form_recipients
				?.filter((data) => data?.status !== "pending")
				?.map((r) => {
					const emailData = getEmailTemplateAndSendMail.call(
						this,
						recipientDetails?.dataValues?.pdf_form?.id,
						{
							declinedBy: recipientDetails?.name,
							email: r?.email,
							name: r?.name,
						},
						{
							title: recipientDetails?.dataValues?.pdf_form
								?.title,
							user: {
								full_name:
									recipientDetails?.dataValues?.pdf_form
										?.dataValues?.user?.dataValues
										?.full_name,
								email: recipientDetails?.dataValues?.pdf_form
									?.dataValues?.user?.dataValues?.email,
							},
							company: {
								name: recipientDetails?.dataValues?.pdf_form
									?.dataValues?.company?.dataValues?.name,
								id: recipientDetails?.dataValues?.pdf_form
									?.dataValues?.company?.dataValues?.id,
							},
						},
						"document_declined_by_recipient",
						false,
						"",
						"",
						reason_for_declining
					);
					return emailData;
				})
		);

		// send email to discontinued the old email data
		// recipientEmailArr.forEach((r) =>
		// this.sendEmail(r) // Node mailer

		// );

		const mailArr = recipientEmailArr?.filter(
			(r) => r !== undefined || r !== null
		);
		console.log(
			"**************** decline form to  all recipients ***********************"
		);
		if (mailArr?.length > 0) {
			this.broker.call("sesEmail.sendSliceSealForm", {
				mailArr: mailArr,
			});
		}
		await t.commit();
		return {
			code: RESPONSES.status.success,
			message: RESPONSES.messages.success,
		};
	} catch (error) {
		await t.rollback();
		console.error("Error in declineForm:", error);
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
			error: error.message,
		};
	}
}

function identifySignerAndViewer(recipientData, mode) {
	if (!Array.isArray(recipientData) || recipientData.length === 0) {
		return { signer: [], viewer: [] };
	}

	let viewers = [];
	let signers = [];

	const filteredRecipients = recipientData.filter((recipient) => {
		return recipient.status !== "revoked";
	});

	if (filteredRecipients.length === 0) {
		return { signer: [], viewer: [] };
	}

	if (
		filteredRecipients?.every((recipient) => !recipient?.status) ||
		mode === "duplicate" ||
		mode === "initiate"
	) {
		// create mode
		const firstRecipient = filteredRecipients[0];
		if (firstRecipient?.role === "signer") {
			return {
				signer: [firstRecipient],
				viewer: [],
			};
		} else {
			const signerIndex = filteredRecipients.findIndex(
				(recipient) => recipient?.role === "signer"
			);
			if (signerIndex !== -1) {
				signers = [filteredRecipients?.[signerIndex]];
				viewers = filteredRecipients?.slice(0, signerIndex);
			} else {
				viewers = filteredRecipients;
			}
		}
	} else {
		//edit mode
		let firstRecipient;
		// find first recipient which status is pending
		const firstPendingRecipient = filteredRecipients.find(
			(recipient) => recipient?.status === "pending"
		);

		const firstBouncedRecipient = filteredRecipients.find(
			(recipient) => recipient?.status === "bounced"
		);

		// find index of the first pending recipient
		const firstPendingRecipientIndex = filteredRecipients.findIndex(
			(recipient) => recipient?.status === "pending"
		);

		const firstBouncedRecipientIndex = filteredRecipients.findIndex(
			(recipient) => recipient?.status === "bounced"
		);

		// if pending recipient is before bounced recipient then signer is pending recipient
		if (
			firstPendingRecipientIndex < firstBouncedRecipientIndex ||
			firstPendingRecipientIndex !== -1
		) {
			firstRecipient = [firstPendingRecipient];
		}

		// if bounced recipient is before pending recipient then signer is bounced recipient
		else {
			firstRecipient = [firstBouncedRecipient];
		}

		if (firstPendingRecipient?.role === "signer") {
			signers = firstRecipient;
		} else {
			const signerIndex = filteredRecipients.findIndex(
				(recipient) =>
					(recipient?.role === "signer" &&
						// recipient?.status === "pending"
						recipient?.status === "mailed") ||
					recipient?.status === "pending"
			);
			if (signerIndex !== -1) {
				signers = [filteredRecipients?.[signerIndex]];
				viewers = filteredRecipients?.slice(
					firstPendingRecipientIndex,
					signerIndex
				);
			} else {
				viewers = filteredRecipients;
			}
		}
	}

	return { signer: signers, viewer: viewers };
}

async function extractSignatureDetails() {
	try {
		const filePath = path.join(
			__dirname,
			"..",
			"..",
			"assets",
			"pdfcertificate",
			"test.pdf"
		);

		const fileBytes = fs.readFileSync(filePath);

		const certificatePath = path.join(
			__dirname,
			"..",
			"..",
			"assets",
			"certificates",
			"client-identity.p12"
		);

		const p12Buffer = fs.readFileSync(certificatePath);

		// Parse the .p12 file
		const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString("binary"));
		const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, "test1234");

		// Extract certificate and private key
		const bags = p12.getBags({
			bagType: forge.pki.oids.certBag,
		});
		const certificate = bags[forge.pki.oids.certBag][0].cert;

		// Extract the public key from the certificate
		const publicKey = certificate.publicKey;

		const pdfDoc = await PDFDocument.load(fileBytes);

		// Access the signature field
		const form = pdfDoc.getForm();
		const fields = form.getFields();

		// Find the signature field (replace with your field name if known)
		const signatureField = fields.find((field) =>
			field.getName().includes("Sig")
		);

		if (!signatureField) {
			// throw new Error("No signature field found in the PDF.");
			console.log("No signature field found in the PDF.");
			return;
		}

		// Extract the signature dictionary from the field
		const signatureFieldRef = signatureField.acroField.dict.get(
			PDFName.of("V")
		);
		const signatureObj = pdfDoc.context.lookup(signatureFieldRef);

		// Get the ByteRange and extract the signature data
		const signature = signatureObj.get(PDFName.of("Contents"));

		const byteRange = signatureObj.get(PDFName.of("ByteRange"))?.array;

		const reason = signatureObj.get(PDFName.of("Reason"))?.decodeText();

		const location = signatureObj.get(PDFName.of("Location"))?.decodeText();

		const contactInfo = signatureObj
			.get(PDFName.of("ContactInfo"))
			?.decodeText();

		const name = signatureObj.get(PDFName.of("Name"))?.decodeText();

		console.log(reason, location, contactInfo, name, "DETAILS");

		// Parse the ByteRange
		const byteRangeArray = byteRange.map((entry) => entry.number);
		const [start1, length1, start2, length2] = byteRangeArray;

		const signedData = Buffer.concat([
			Buffer.from(fileBytes.subarray(start1, start1 + length1)),
			Buffer.from(fileBytes.subarray(start2, start2 + length2)),
		]);

		console.log(
			forge.md.sha256.create().update(signedData).digest().bytes(),
			"PUBLIC KEY"
		);

		console.log("Public Key Size:", publicKey.n.bitLength());

		// Decode the signature using node-forge
		const signatureBytes = forge.util.decode64(
			btoa(
				signature
					.toString()
					.match(/\w{2}/g)
					.map(function (a) {
						return String.fromCharCode(parseInt(a, 16));
					})
					.join("")
			)
		);

		//get signature as ASN1 object
		const signatureAsn1 = forge.asn1.fromDer(signatureBytes, {
			// strict: false,
			parseAllBytes: false,
			// decodeBitStrings: false,
		});

		const message = forge.pkcs7.messageFromAsn1(signatureAsn1);

		// console.log("Certificate:", message);

		const cert = message.certificates[0];

		const hashAlgorithmOid = forge.asn1.derToOid(
			message.rawCapture.digestAlgorithm
		);
		const hashAlgorithm = forge.pki.oids[hashAlgorithmOid].toLowerCase();

		const set = forge.asn1.create(
			forge.asn1.Class.UNIVERSAL,
			forge.asn1.Type.SET,
			true,
			message.rawCapture.authenticatedAttributes
		);

		const digest = forge.md[hashAlgorithm]
			.create()
			.update(forge.asn1.toDer(set).data)
			.digest()
			.getBytes();

		const verified = publicKey.verify(
			digest,
			message.rawCapture.signature
			// undefined,
			// { _parseAllDigestBytes: false }
		);

		console.log("Verified:", verified);

		if (verified) {
			console.log("Signature is valid");
		} else {
			console.error("Signature is invalid.");
		}

		//Extract certificate details
		const certDetails = {
			issuer: cert.issuer.attributes
				.map((attr) => `${attr.name}=${attr.value}`)
				.join(", "),
			subject: cert.subject.attributes
				.map((attr) => `${attr.name}=${attr.value}`)
				.join(", "),
			validity: {
				notBefore: cert.validity.notBefore,
				notAfter: cert.validity.notAfter,
			},
		};

		// Set the details in state
		console.log("Certificate Details:", certDetails);
	} catch (error) {
		console.error("Error extracting signature details:", error);
	}
}
// web hook logic
async function updateRecipientStatus(ctx) {
	try {
		console.log("inside updateRecipientStatus event=== send");

		const event = ctx?.params?.event;
		const companyId = ctx?.params?.company_id;

		console.log("events______", ctx?.params?.event);

		if (event === "send") {
			const response = ctx?.params?.data;
			await Promise.all(
				response?.map((r) => {
					const updateBlock =
						// r?.role === "viewer"
						// 	? {
						// 			status: "completed",
						// 			message_id:
						// 				r?.messageId || r?.MessageId,
						// 	  }
						// 	:
						{
							message_id: r?.messageId || r?.MessageId,
						};

					this.settings.models.pdfFormRecipients.update(updateBlock, {
						where: {
							status: {
								[Op.not]: ["revoked"],
							},
							email: r?.email,
							form_id: r?.formId,
							company_id: companyId,
						},
					});
				})
			);
		} else if (event === "bounced") {
			console.log("inside updateRecipientStatus event=== bounced");
			const messageId = ctx.params?.data;

			console.log("data_message_id", messageId, ctx.params?.data);

			const resp = await this.settings.models.pdfFormRecipients.update(
				{
					status: "bounced",
				},
				{
					where: {
						message_id: messageId,
						// tenant id
					},
				}
			);

			console.log("bounced_updated", resp);

			const recipientData =
				await this.settings.models.pdfFormRecipients.findOne({
					where: {
						message_id: messageId,
					},
					include: [
						{
							model: this.settings.models.pdfForms,
							include: [
								{
									model: this.settings.models.users,
									attributes: ["id", "full_name", "email"],
								},
								{
									model: this.settings.models.companies,
									attributes: ["id", "name"],
								},
							],
						},
					],
				});

			// form track bounce event in the history.

			await this.settings.models.pdfFormHistory.create({
				activity: `${recipientData?.dataValues?.email} email has been Bounced`,
				action: "bounced",
				form_id: recipientData?.dataValues?.pdf_form?.id,
				company_id:
					recipientData?.dataValues?.pdf_form?.dataValues?.company
						?.dataValues?.id,
				performer_name: "System",
			});

			const emailData = await getEmailTemplateAndSendMail.call(
				this,
				recipientData?.dataValues?.form_id,
				{
					email: recipientData?.dataValues?.pdf_form?.dataValues?.user
						?.dataValues?.email,
					name: recipientData?.dataValues?.pdf_form?.dataValues?.user
						?.dataValues?.full_name,
					bounce_email: recipientData?.dataValues?.email,
				},
				{
					title: recipientData?.dataValues?.pdf_form?.dataValues
						?.title,
					user: {
						full_name:
							recipientData?.dataValues?.pdf_form?.dataValues
								?.user?.dataValues?.full_name,
						email: recipientData?.dataValues?.pdf_form?.dataValues
							?.user?.dataValues?.email,
					},
					company: {
						name: recipientData?.dataValues?.pdf_form?.dataValues
							?.company?.dataValues?.name,
						id: recipientData?.dataValues?.pdf_form?.dataValues
							?.company?.dataValues?.id,
					},
				},
				"undeliverable_document"
			);

			if (emailData) {
				if (emailData) {
					this.broker.call("sesEmail.sendSliceSealForm", {
						mailArr: [emailData],
					});
				}
			}
		}
	} catch (error) {
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
			error: error.message,
		};
	}
}

async function findSliceSealSettingsByCompanyId(companyId) {
	try {
		const settings = await this.settings.models.settings.findOne({
			where: { company_id: companyId },
			attributes: ["reminder_days", "session_timeout_for_recipient"],
		});
		return settings;
	} catch (error) {
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
			error: error.message,
		};
	}
}

async function sendReminderToRecipients(ctx) {
	const t = await sequelize.transaction();
	try {
		const formId = ctx.params.id;
		const companyId =
			ctx?.meta?.user?.company_id || ctx?.params?.company_id;

		const formSettings = await this.broker.call(
			"settings.getSettingsList",
			{
				company_id: companyId,
			}
		);

		const formDetails = await this.settings.models.pdfForms.findOne({
			where: {
				id: formId,
				company_id: companyId,
			},
			include: [
				{
					model: this.settings.models.pdfFormRecipients,
					where: {
						[Op.and]: [
							{ status: { [Op.ne]: "revoked" } },
							{
								[Op.or]: [
									{ status: "mailed" },
									{ status: "viewed" },
									{ status: "bounced" },
								],
							},
							{ role: "signer" },
						],
					},
					attributes: [
						"id",
						"company_id",
						"email",
						"token",
						"status",
						"name",
						"role",
					],
				},
				{
					model: this.settings.models.users,
					attributes: ["full_name", "email", "id"],
				},
				{
					model: this.settings.models.companies,
					attributes: ["name", "id"],
				},
			],
			attributes: [
				"id",
				"title",
				"company_id",
				// "expiration_at",
				"expiration_date",
				"status",
			],
		});

		if (formDetails?.status === "completed") {
			await t.rollback();
			return {
				code: RESPONSES.status.error,
				message:
					"The document has been completed, and the reminder could not be sent.",
			};
		} else if (formDetails?.status === "declined") {
			await t.rollback();
			return {
				code: RESPONSES.status.error,
				message:
					"The document has been declined, and the reminder could not be sent",
			};
		}

		// As per change user can send reminder to bounced also users
		// if (
		// 	formDetails?.dataValues?.pdf_form_recipients?.some(
		// 		(r) => r?.dataValues?.status === "bounced"
		// 	)
		// ) {
		// 	return {
		// 		code: RESPONSES.status.success,
		// 		message:
		// 			"The user's email has bounced. Please replace the user",
		// 	};
		// }

		const recipients = formDetails?.dataValues?.pdf_form_recipients;

		const formExpirationDate =
			formDetails?.dataValues?.expiration_date &&
			moment(formDetails?.dataValues.expiration_date).format(
				`${formSettings?.data?.date_format} ${
					formSettings?.data?.time_format === "12-Hours"
						? "hh:mm A"
						: "HH:mm"
				}`
			);

		const emailArr = await Promise.all(
			recipients?.map(async (recipient) => {
				const mailData = await getEmailTemplateAndSendMail.call(
					this,
					formId,
					{
						name: recipient?.name,
						email: recipient?.email,
						token: recipient?.token,
						role: recipient?.role,
					},
					{
						title: formDetails?.title,
						expirationDate:
							formExpirationDate ||
							formDetails?.dataValues?.expiration_date,
						user: {
							full_name: formDetails?.user?.full_name,
						},
						company: {
							name: formDetails?.company?.name,
							id: formDetails?.company?.id,
						},
					},
					"reminder_to_sign_document"
					// formSettings?.data?.validity_type === "forever"
					// 	? "reminder_to_sign_document_forever"
					// 	: "reminder_to_sign_document"
				);

				return mailData;
			})
		);

		const mailArr = emailArr?.filter((r) => r !== undefined || r !== null);
		if (mailArr?.length > 0) {
			this.broker.call("sesEmail.sendSliceSealForm", {
				mailArr: mailArr,
				trackEvent: true,
			});
		}

		await this.settings.models.pdfFormHistory.create(
			{
				activity: "Reminder has been Sent",
				action: "reminded",
				form_id: formId,
				company_id: companyId,
				performed_by: ctx?.meta?.user?.id,
			},
			{
				transaction: t,
			}
		);

		await t.commit();
		return {
			code: RESPONSES.status.success,
			message: RESPONSES.messages.success,
		};
	} catch (error) {
		await t.rollback();
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
			error: error.message,
		};
	}
}

async function removeFilesOfDeletedForms() {
	const t = await sequelize.transaction();
	try {
		// const companyData = await this.settings.models.companies.findAll({
		// 	attributes: ["id", "name"],
		// });

		// for (const company of companyData) {
		// const companyId = company.id;

		const forms = await this.settings.models.pdfForms.findAll({
			where: {
				// company_id: companyId,
				status: "deleted",
				is_deleted: true,
				form_url: { [Op.ne]: null },
			},
			attributes: ["id", "form_url", "key"],
		});

		if (Array.isArray(forms) && forms.length > 0) {
			for (const form of forms) {
				const key = form?.key || form?.dataValues?.key;
				if (key) {
					await this.fileDeleteFromS3(key);
					await this.settings.models.pdfForms.update(
						{
							form_url: null,
							key: null,
						},
						{
							where: {
								id: form.id,
							},
							transaction: t,
						}
					);
				}
			}
		}

		const files = await this.settings.models.pdfFormFiles.findAll({
			where: {
				// company_id: companyId,
				is_deleted: true,
				file_url: { [Op.ne]: null },
			},
			attributes: ["id", "file_url", "key"],
		});

		if (Array.isArray(files) && files.length > 0) {
			for (const file of files) {
				const key = file?.key || file?.dataValues?.key;
				if (key) {
					await this.fileDeleteFromS3(key);
					await this.settings.models.pdfFormFiles.update(
						{
							file_url: null,
							key: null,
						},
						{
							where: {
								id: file.id,
							},
							transaction: t,
						}
					);
				}
			}
		}
		await t.commit();
	} catch (error) {
		await t.rollback();
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}
async function addTextWatermark(fileName, fileStream) {
	try {
		const pdfDoc = await PDFDocument.load(fileStream);

		// Embed a font for the watermark
		const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

		// Define the watermark text and color
		const watermarkText = "VOID";
		const watermarkColor = rgb(0.95, 0.1, 0.1);

		// Add the watermark to each page
		const pages = pdfDoc.getPages();
		for (const page of pages) {
			const { width, height } = page.getSize();
			page.drawText(watermarkText, {
				x: width / 2 - 20,
				y: height / 2,
				size: 50,
				font,
				color: watermarkColor,
				rotate: { type: "degrees", angle: 45 },
				opacity: 0.5,
			});
		}

		const pdfBytes = await pdfDoc.save();

		// fs.writeFileSync(outputFilePath, pdfBytes);
		console.log("PDF TEXT watermark added successfully");

		return pdfBytes;
	} catch (error) {
		console.log(error, "WATERMARK ERROR");
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}

async function addDocumentID(data) {
	try {
		const formUrl = data?.form_url;
		const fileStream = await this.readFileIntoBuffer(formUrl);

		//fetch the data from the settings broker call
		// const formSettings = await this.broker.call(
		// 	"settings.getSettingsList",
		// 	{
		// 		company_id: data?.company_id,
		// 	}
		// );

		const pdfDoc = await PDFDocument.load(fileStream);

		const font = await embedFont("Arial", pdfDoc);
		const pages = pdfDoc.getPages();

		for (const page of pages) {
			const { height } = page.getSize();
			page.drawText(`Document Id: ${data?.document_id}`, {
				x: 10, // Small margin from the left edge
				y: height - 15, // Close to the top of the page
				size: 7,
				font,
				color: rgb(0, 0, 0),
				rotate: { type: "degrees", angle: 0 }, // No rotation
				opacity: 1,
			});
		}
		const pdfBytes = await pdfDoc.save();
		console.log("PDF TEXT DocumentID added successfully");
		const documentBuffer = Buffer.from(pdfBytes);
		const dir = "signify/forms";
		await this.updateFileData(
			data?.title,
			data?.key,
			"pdf",
			dir,
			documentBuffer
		);
		// fileName,
		// Key,
		// MimeType,
		// Location,
		// buffer
		console.log("Document ID added successfully to the PDF file.");
	} catch (error) {
		console.log(error, "Error during generating document ID");
	}
}

async function extendExpirationDate(ctx) {
	try {
		const { id, newExpirationDate } = ctx.params;
		const companyId =
			ctx?.meta?.user?.company_id || ctx?.params?.company_id;

		await this.settings.models.pdfForms.update(
			{
				expiration_date: newExpirationDate,
				status: "pending",
			},
			{
				where: {
					id,
					company_id: companyId,
				},
			}
		);

		return {
			code: RESPONSES.status.success,
			message: RESPONSES.messages.success,
			data: "Expiration date updated successfully",
		};
	} catch (error) {
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
			error: error.message,
		};
	}
}

async function getUserSignature(ctx) {
	try {
		const { id, email } = ctx.params;
		const company_id =
			ctx?.meta?.user?.company_id || ctx?.params?.company_id;

		const signatureData =
			await this.settings.models.pdfFormSignatureInitials.findOne({
				where: {
					user_id: id,
					company_id,
				},
				attributes: [
					"initials_url",
					"signature_url",
					"sign_uuid",
					"email",
				],
			});

		if (signatureData) {
			return {
				code: RESPONSES.status.success,
				message: RESPONSES.messages.success,
				data: signatureData,
			};
		} else {
			const { randomUUID } = new ShortUniqueId({ length: 10 });
			// create signature
			const signature =
				await this.settings.models.pdfFormSignatureInitials.create({
					email,
					sign_uuid: `SIG-${randomUUID()}`,
					company_id,
					user_id: id,
				});

			return {
				code: RESPONSES.status.success,
				message: RESPONSES.messages.success,
				data: signature,
			};
		}
	} catch (error) {
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
			error: error.message,
		};
	}
}
async function selfSign(ctx) {
	try {
		// create function for self sign
		const formData = ctx.params.formData;
		const selfSigned = true;
		const { randomUUID } = new ShortUniqueId({ length: 10 });
		const mode = "create";
		let recipientsDetails = formData?.recipients;
		const companyId =
			ctx?.meta?.user?.company_id || ctx?.params?.company_id;
		const formSettings = await this.broker.call(
			"settings.getSettingsList",
			{
				company_id: companyId,
			}
		);

		const parser = new UAParser();
		parser.setUA(ctx.meta.userAgent);
		const browserDetails = parser.getResult();
		const { browser: browserInfo, os } = browserDetails;
		const ip = ctx.meta.ip;
		const browser = `${browserInfo.name} ${os.name}`;

		const { initials_url, initials_key, signature_key, signature_url } =
			formData.signature_data || {};
		// const isSignatureRequired = initials_url || signature_url ? true : false;
		const isSignatureRequired = formData?.recipients?.[0]?.fields?.some(
			(r) => r?.type === "digital signature" || r?.type === "signature"
		);
		// save the file details in PdfFormFiles table
		let fileDetails = await handleFileDetails.call(
			this,
			mode,
			"form",
			formData,
			companyId,
			ctx,
			null,
			selfSigned
			// t
		);
		// let's save the form details in pdfForms table
		const formDataResp = await createOrUpdateFormData.call(
			this,
			mode,
			"form",
			formData,
			fileDetails,
			formData?.title,
			false,
			false,
			null,
			companyId,
			randomUUID,
			ctx,
			formSettings,
			null,
			selfSigned
			// t
		);

		if (formSettings?.data?.document_id) {
			const newObj = {
				...formDataResp?.dataValues,
			};
			const newFile = await this.copyObject(
				{
					file_url: newObj?.file_url,
					key: newObj?.key,
					file_name: newObj?.title,
				},
				"SLICE HRMS/images/signify/forms/"
			);
			await this.settings.models.pdfForms.update(
				{
					form_original_key: newFile.key,
					form_original_url: newFile.fileUrl,
					// document_id: `DF-${randomUUID()}-${companyId}-${Date.now()}`,
				},
				{
					where: {
						id: newObj?.id,
					},
				}
			);
			// }

			await addDocumentID.call(this, newObj);
		}

		const recipientDataArray = await prepareRecipientData.call(
			this,
			recipientsDetails?.filter((r) => r?.status !== "completed"),
			false,
			false,
			formDataResp?.id,
			companyId
		);

		await addSignId.call(this, recipientDataArray, companyId, randomUUID);

		const recipientData = (
			await this.settings.models.pdfFormRecipients.bulkCreate(
				recipientDataArray
					.filter((data) => !("isOld" in data))
					.map((r) => ({ ...r, status: "completed" })),
				{
					returning: true,
					//  transaction: t
				}
			)
		)?.map((r) => r.get({ plain: true }));

		//
		const { email, user_id } = recipientData[0];
		const updatedObj = {};
		if (initials_url) {
			updatedObj.initials_url = initials_url;
			updatedObj.initials_key = initials_key;
		}
		if (signature_url) {
			updatedObj.signature_url = signature_url;
			updatedObj.signature_key = signature_key;
		}

		const whereClause = { email, user_id, company_id: companyId };

		// Check for previous stored signature/initials
		const previousData =
			await this.settings.models.pdfFormSignatureInitials.findOne({
				where: whereClause,
			});

		if (previousData) {
			const { initials_url, signature_url, initials_key, signature_key } =
				previousData.dataValues || {};
			const previousFileArr = [];

			// Collect only changed files for deletion
			if (initials_url && initials_url !== initials_url) {
				previousFileArr.push(initials_key);
			}
			if (signature_url && signature_url !== signature_url) {
				previousFileArr.push(signature_key);
			}

			if (previousFileArr.length) {
				await this.bulkDeleteFromS3(previousFileArr.filter(Boolean));
			}
		}

		// Update only if there's something to update
		if (Object.keys(updatedObj).length) {
			await this.settings.models.pdfFormSignatureInitials.update(
				updatedObj,
				{
					where: whereClause,
				}
			);
		}

		const fieldResponse = await createFieldRecords.call(
			this,
			recipientsDetails,
			companyId,
			formDataResp?.id,
			mode,
			"form",
			recipientData,
			null
			// t
		);
		fieldResponse.forEach((field) => {
			if (field?.field_type === "digital signature") {
				field.field_Data = signature_url;
			}
			if (field?.field_type === "initial") {
				field.field_Data = initials_url;
			}
		});

		await createOrUpdateTags.call(
			this,
			formData?.tags,
			formDataResp?.id,
			mode,
			companyId
		);

		let companyData = await this.broker.call("companies.getById", {
			id: companyId,
		});

		const dir = "signify/forms";
		const localPath = "./assets/";
		let combinedFilePath = null;
		let formUrl = formDataResp?.form_url;
		let combinedFileURL = null;
		const fileUniqueTimeStamp = Date.now();
		const { filePath: pdfPath } = await this.getFileAndWrite(
			null,
			`${localPath}/${fileUniqueTimeStamp}-${formDataResp?.title}.pdf`,
			formDataResp?.form_url
		);

		await this.settings.models.pdfFormHistory.create({
			activity: "Document has been Self Signed",
			action: "signed",
			form_id: formDataResp?.id,
			company_id: companyData?.data?.id,
			performer_name: ctx?.meta?.user?.full_name,
			ip,
			browser,
			performed_by: ctx?.meta?.user?.id,
			performer_color: recipientData[0]?.color,
		});

		const response = await addAuditLog.call(
			this,
			{
				full_name: ctx.meta?.user?.full_name,
				email: ctx.meta?.user?.email,
			},
			pdfPath,
			false,
			formDataResp,
			companyData,
			dir,
			localPath,
			isSignatureRequired,
			null,
			false
		);

		if (isSignatureRequired) {
			combinedFilePath = response?.combinedFilePath;
		} else {
			formUrl = response?.url ? response?.url : formUrl;
			combinedFileURL = response?.combinedFileUrl;
		}

		if (isSignatureRequired) {
			const signedResponse =
				!formDataResp?.attach_audit_log &&
				(await applySign.call(
					this,
					pdfPath,
					formDataResp,
					recipientData[0],
					companyData,
					dir,
					false
				));

			// apply signature on combined file
			const combinedFileURLResponse =
				isSignatureRequired && combinedFilePath
					? await applySign.call(
							this,
							combinedFilePath,
							formDataResp,
							recipientData[0],
							companyData,
							dir
					  )
					: null;

			formUrl = isSignatureRequired ? signedResponse?.url : formUrl;

			if (isSignatureRequired && formDataResp?.attach_audit_log) {
				formUrl = combinedFileURLResponse?.url;
			}

			if (combinedFileURL || combinedFilePath) {
				await this.settings.models.pdfForms.update(
					{
						form_url: formUrl,
						combined_file_url: combinedFileURLResponse?.url,
					},
					{
						where: {
							id: formDataResp?.id,
							company_id: companyData?.data?.id,
						},
						// transaction: t,
					}
				);
			}
		}

		await this.settings.models.pdfForms.update(
			{
				form_url: formUrl,
			},
			{
				where: {
					id: formDataResp?.id,
					company_id: companyData?.data?.id,
				},
				// transaction: t,
			}
		);

		if (!isSignatureRequired) {
			try {
				await fs.promises.unlink(pdfPath);
			} catch (err) {
				console.error("Error deleting PDF:", err);
			}
		}

		//"document_signed_by_all_recipients"
		const mailData2 = await getEmailTemplateAndSendMail.call(
			this,
			formDataResp?.id,
			{
				name: recipientData[0]?.name,
				email: recipientData[0]?.email,
				role: recipientData[0]?.role,
			},
			{
				token: formDataResp?.form_token,
				title: formDataResp?.title,
				user: {
					full_name: ctx.meta?.user?.full_name,
					email: ctx.meta?.user?.email,
				},
				company: {
					name: companyData?.data?.name,
					id: companyData?.data?.id,
				},
			},
			"document_signed_by_all_recipients"
		);

		if (mailData2) {
			this.broker.call("sesEmail.sendSliceSealForm", {
				mailArr: [mailData2],
			});
		}

		return {
			code: RESPONSES.status.success,
			message: RESPONSES.messages.success,
		};

		// mailArr.push(mailBody);
	} catch (error) {
		console.log(error, "Error during self-signing");
		return {
			code: RESPONSES.status.error,
			message: RESPONSES.messages.internal_server_error,
		};
	}
}
// function updatedStatusBasedOnPriority(data, recipientDetails) {
// 	try {
// 		// this function is used when priority is Required
// 		const result = [...data].map((r) => ({ ...r })); // deep copy to avoid mutating original
// 		// const completedRecipients = result.some(
// 		// 	(recipient) => recipient.status === "completed"
// 		// );

// 		const sorted = [...result].sort((a, b) => a.r_priority - b.r_priority);
// 		// let mailedSet = false;

// 		// return sorted.map((r) => {
// 		// 	if (!mailedSet && r.status !== "completed") {
// 		// 		mailedSet = true;
// 		// 		return { ...r, status: "mailed" };
// 		// 	} else if (r.status !== "completed") {
// 		// 		return { ...r, status: "pending" };
// 		// 	} else {
// 		// 		return r; // already completed
// 		// 	}
// 		// });

// 		// slice recipientDetails till sorted 1st element r_priority

// 		const sortedPriorities = sorted.map((r) => r.r_priority);
// 		const pointerPosition = recipientDetails.findIndex((rd) =>
// 			sortedPriorities.includes(rd.r_priority)
// 		);

// 		const leftSideArr = recipientDetails.slice(0, pointerPosition);

// 		if (leftSideArr.length === 0 || pointerPosition === 0) {
// 			if (pointerPosition === 0 && sorted[0].role === "viewer") {
// 				const { signer, viewer } = identifySignerAndViewer(
// 					data,
// 					"edit"
// 				);

// 				const viewersArr = viewer.map((v) => ({
// 					...v,
// 					status: "mailed",
// 				}));

// 				const signerArr = signer.map((s, j) => {
// 					if (j === 0) {
// 						return {
// 							...s,
// 							status: "mailed",
// 						};
// 					}
// 					return s;
// 				});

// 				return [...viewersArr, signerArr];
// 			}

// 			return sorted.map((r, i) => {
// 				return {
// 					...r,
// 					status: i === 0 ? "mailed" : "pending",
// 				};
// 			});
// 		}

// 		if (
// 			leftSideArr?.some(
// 				(r) =>
// 					r.status == "pending" ||
// 					(r.status == "mailed" && r.role !== "viewer")
// 			)
// 		) {
// 			return sorted.map((r) => ({
// 				...r,
// 				status: "pending",
// 			}));
// 		} else {
// 			return sorted.map((r, i) => ({
// 				...r,
// 				status: i === 0 ? "mailed" : "pending",
// 			}));
// 		}
// 	} catch (error) {
// 		console.log(error);
// 		return data; // fallback if error
// 	}
// }

async function prepareRecipientAndEditForm(
	fileDetails,
	oldFormData,
	previousContentId,
	companyId,
	recipientsDetails,
	title,
	ctx,
	emailSubject,
	emailTemplate,
	companyData,
	randomUUID
) {
	try {
		//
		const historyArr = [];
		if (fileDetails?.form_original_key && fileDetails?.key) {
			await this.bulkDeleteFromS3([
				oldFormData?.key,
				oldFormData?.form_original_key,
			]);
		}

		// for draft form we will delete all users and insert new payload

		if (oldFormData?.status === "draft") {
			await this.settings.models.pdfFormRecipients.destroy({
				where: {
					form_id: previousContentId,
					company_id: companyId,
				},
				// transaction: t,
			});
		}

		// find which recipient is added and which one is removed

		// old recipients (remainingRecipient)
		let remainingRecipients =
			await this.settings.models.pdfFormRecipients.findAll({
				where: {
					form_id: previousContentId,
					company_id: companyId,
					[Op.and]: [
						{ status: { [Op.ne]: "revoked" } },
						{
							[Op.or]: [
								{ status: "mailed" },
								{ status: "viewed" },
								{ status: "pending" },
								{ status: "bounced" }, // bounced
							],
						},
					],
				},
				attributes: [
					"id",
					"company_id",
					"email",
					"token",
					"r_priority",
					"status",
					"name",
					"role",
				],
			});

		// check remaining recipient and recipientsDetails and find which recipient is added and which one is removed

		// recipient which have different id means newly added and removed recipients
		const differentRecipients = remainingRecipients.filter(
			(r) =>
				!recipientsDetails.some(
					(rd) => rd?.id === r?.id && rd?.token === r?.token
				)
		);

		// filter deleted recipients. we need to find those recipient which are already available in table so find them using token

		const deletedRecipients = differentRecipients.filter(
			(recipient) =>
				recipient?.dataValues && "token" in recipient.dataValues
		);

		// we created the new recipient Array which has newly added user and remaining recipient

		// remove deleted recipients from remaining recipient array
		const remainingRecipientWithoutDeletedUsers =
			remainingRecipients.filter(
				(user) => !deletedRecipients.includes(user)
			);

		// so created the new recipient details array which has updated recipients and new recipients
		const remainingRecipientWithNewRecipients = [
			...remainingRecipientWithoutDeletedUsers, // with old details
			// ...newRecipients,
		];

		// we find the same recipient which have same email id and Id with different role(in update)
		const sameRecipientsWithDifferentRole = remainingRecipients
			.map((r) => {
				const recipient = recipientsDetails.find(
					(rd) => rd.id === r.id
				);
				return recipient && recipient.role !== r.role
					? { ...recipient, token: r.token }
					: null;
			})
			.filter(Boolean);

		console.log("sameRecipients", sameRecipientsWithDifferentRole);

		const needToDeleteUsers = [
			...deletedRecipients,
			...sameRecipientsWithDifferentRole,
			// ...changedPriorityRecipients,
		];

		const uniqueNeedToDeleteUsers = needToDeleteUsers.filter(
			(value, index, self) =>
				index === self.findIndex((t) => t.id === value.id)
		);

		console.log("uniqueNeedToDeleteUsers", uniqueNeedToDeleteUsers);

		// we removed the user and sending the email to removed user and destroy the fields
		const removedUserData = await Promise.all(
			uniqueNeedToDeleteUsers?.map(async (r) => {
				// so we delete the old role user and create entry in Revoked user table
				await this.settings.models.pdfFormRecipients.destroy({
					where: { id: r?.id, company_id: companyId },
					// transaction: t,
				});

				await this.settings.models.pdfFormRevokedUsers.create(
					{
						company_id: companyId,
						form_id: previousContentId,
						name: r?.name,
						email: r?.email,
						token: r?.token,
					}
					// {
					// 	transaction: t,
					// }
				);
				// }
				// if (r?.status !== "pending" )
				historyArr.push({
					activity: `Document has been revoked from the ${r?.name}`,
					action: "corrected",
					form_id: previousContentId,
					company_id: companyId,
					performer_name: ctx?.meta?.user?.full_name,
					performed_by: ctx?.meta?.user?.id,
				});
				if (["viewed", "mailed", "bounced"].includes(r?.status)) {
					const mailData = await getEmailTemplateAndSendMail.call(
						this,
						previousContentId,
						{
							name: r?.name,
							email: r?.email,
						},
						{
							title: title || fileDetails?.file_name,
							user: {
								full_name: ctx.meta?.user?.full_name,
								email: ctx.meta?.user?.email,
							},
							company: {
								name: oldFormData?.dataValues?.company?.name,
								id: oldFormData?.dataValues?.company?.id,
							},
						},
						"recipient_removed"
					);

					return mailData;
				}
			})
		);

		const removedUserArr = removedUserData?.filter(
			(r) => r != null || r != undefined
		);

		if (removedUserArr?.length > 0) {
			this.broker.call("sesEmail.sendSliceSealForm", {
				mailArr: removedUserArr,
			});
		}
		// update the recipient details based on the priority
		const updatedRecipientsDetails =
			updateRecipientDetailsBasedOnPriorityInArray(
				recipientsDetails,
				oldFormData?.is_priority_required,
				oldFormData?.dataValues?.status
			);
		const newUpdatedRecipientsDetails = updatedRecipientsDetails.filter(
			(r) => r?.status !== "completed"
		);

		// now we need to check if any user has changed the name, email,role or priority
		// so we will check the remainingRecipientWithNewRecipients with recipientsDetails and find the difference
		const changedRecipientsData = await Promise.all(
			newUpdatedRecipientsDetails.map(async (recipient) => {
				//matching the id of recipients and check there role is same

				// it means user is newly added
				if (recipient?.isNew) {
					return null;
				}

				const matchingRecipient =
					remainingRecipientWithNewRecipients.find(
						(r) =>
							r?.id === recipient?.id && //
							!sameRecipientsWithDifferentRole.some(
								(sr) => sr.id === r.id
							)
					);

				if (
					matchingRecipient && // id is there and its not draft and status is viewed mailed and pending
					oldFormData?.dataValues?.status !== "draft" &&
					["viewed", "mailed", "pending", "bounced"].includes(
						matchingRecipient?.status
					)
				) {
					if (
						matchingRecipient?.email !== recipient?.email ||
						matchingRecipient?.name !== recipient?.name ||
						matchingRecipient?.role !== recipient?.role ||
						matchingRecipient?.r_priority !==
							recipient?.r_priority ||
						matchingRecipient?.status !== recipient?.status
					) {
						recipient.isChanged = true;
						recipient.oldEmail = matchingRecipient?.email;
						recipient.oldName = matchingRecipient?.name;
						recipient.oldToken = matchingRecipient?.token;
						recipient.oldStatus = matchingRecipient?.status;
						return recipient;
					}

					return null;
				}

				return null;
			})
		);

		const changedRecipients = changedRecipientsData?.filter(Boolean);

		// Filter out changed recipients who are not bounced, have changes, and are not pending.
		const removedEmailToChangedRecipients = changedRecipients.filter(
			(r) =>
				r?.isChanged &&
				!["bounced", "pending", "completed"].includes(r?.oldStatus)
		);
		// Removed recipients  email part ++++++++++++++++++++++++++++++++++++
		// we sending email to changed recipients which are revoked
		const changedRecipientOldEmailData = await Promise.all(
			removedEmailToChangedRecipients.map((r) => {
				const emailData = getEmailTemplateAndSendMail.call(
					this,
					previousContentId,
					{
						name: r?.oldName,
						email: r?.oldEmail,
					},
					{
						title: title || fileDetails?.file_name,
						user: {
							full_name: ctx.meta?.user?.full_name,
							email: ctx.meta?.user?.email,
						},
						company: {
							name: oldFormData?.dataValues?.company?.name,
							id: oldFormData?.dataValues?.company?.id,
						},
					},
					"recipient_removed"
				);
				return emailData;
			})
		);

		const changedRecipientOldEmailArr =
			changedRecipientOldEmailData?.filter(Boolean);
		if (changedRecipientOldEmailArr?.length > 0) {
			this.broker.call("sesEmail.sendSliceSealForm", {
				mailArr: changedRecipientOldEmailArr,
				// trackEvent: true,
			});
		}

		// Removed recipients  email part end ------------------------------------

		// we are sending the email to the newly update recipients who has mailed or viewed or bounced status and update the data for pending users
		if (changedRecipients?.length > 0) {
			await addSignId.call(
				this,
				changedRecipients,
				companyId,
				randomUUID
			);

			const newEmailToChangedRecipients = await Promise.all(
				changedRecipients?.map(async (recipient) => {
					const token = crypto.randomBytes(6).toString("hex");

					//Check if the email is suppressed(In invalid email list) list or not
					const isSuppressed =
						recipient &&
						(await this.isEmailSuppressed(recipient?.email));

					recipient.status = isSuppressed
						? "bounced"
						: recipient?.status;

					// if user is replaced at 2 or 3 r_priority then we only update the data because we don't send email to them cause their priority is higher
					if (recipient.status === "pending") {
						await this.settings.models.pdfFormRecipients.update(
							{
								name: recipient?.name,
								email: recipient?.email,
								role: recipient?.role,
								token,
								color: recipient?.color,
								type: recipient?.type,
								status: isSuppressed
									? "bounced"
									: recipient.status,
								r_priority: recipient?.r_priority,
								user_id:
									recipient?.type === "inside_organization"
										? recipient?.user_id
										: null,
							},
							{
								where: {
									company_id: companyId,
									id: recipient?.id,
								},
								// transaction: t,
							}
						);
					} else {
						// added the new row in the form recipient table for the revoked user
						if (
							recipient?.isChanged
							// ||!oldFormData?.dataValues?.is_priority_required
						) {
							// if user name is change or email is change we need to add old user entry in revoked table
							await this.settings.models.pdfFormRevokedUsers.create(
								{
									company_id: companyId,
									form_id: previousContentId,
									name: recipient?.oldName,
									email: recipient?.oldEmail,
									token: recipient?.oldToken,
								}
								// {
								// 	transaction: t,
								// }
							);
						}

						// we update the new user data in the form recipient table
						await this.settings.models.pdfFormRecipients.update(
							{
								name: recipient?.name,
								email: recipient?.email,
								token:
									recipient?.isChanged ||
									!oldFormData?.dataValues
										?.is_priority_required
										? token
										: recipient?.oldToken,
								form_id: recipient?.form_id || oldFormData?.id,
								company_id: companyId,
								color: recipient?.color,
								type: recipient?.type,
								status: isSuppressed
									? "bounced"
									: recipient?.status,
								// recipient?.status === "bounced"
								// 	? "mailed"
								// 	: recipient?.status,
								// r_priority: oldFormData?.dataValues
								// 	?.is_priority_required
								// 	? recipient?.r_priority
								// 	: 0,
								r_priority: recipient?.r_priority,
								role: recipient?.role,
								user_id:
									recipient?.type === "inside_organization"
										? recipient?.user_id
										: null,
							},
							{
								where: {
									company_id: companyId,
									id: recipient?.id, // revoked the old email based row
								},
								// transaction: t,
							}
						);
					}

					console.log("Updated recipient:", recipient);
					// only send mail to viewed and mailed recipients
					if (
						recipient?.status !== "pending" &&
						recipient?.isChanged &&
						isSuppressed === false
						// (recipient?.isChanged ||
						//\ 	!oldFormData?.dataValues?.is_priority_required)
					) {
						historyArr.push({
							activity: `Document has been corrected and sent to the ${recipient?.name}`,
							action: "mailed",
							form_id: previousContentId,
							company_id: companyId,
							performer_name: ctx?.meta?.user?.full_name,
							performed_by: ctx?.meta?.user?.id,
						});

						const emailData = getEmailTemplateAndSendMail.call(
							this,
							previousContentId,
							{
								name: recipient?.name,
								email: recipient?.email,
								token,
								role: recipient?.role,
							},
							{
								title: title || fileDetails?.file_name,
								user: {
									full_name: ctx.meta?.user?.full_name,
								},
								company: {
									name:
										ctx.meta?.user?.company?.name ||
										oldFormData?.dataValues?.company?.name,
									id:
										ctx.meta?.user?.company?.id ||
										oldFormData?.dataValues?.company?.id,
								},
							},
							recipient?.role === "signer"
								? "document_sign_request"
								: "document_viewer",
							false,
							emailSubject,
							emailTemplate
						);

						return emailData;
					}
				})
			);

			const recipientChangeArr =
				newEmailToChangedRecipients?.filter(Boolean);

			if (recipientChangeArr?.length > 0) {
				this.broker.call("sesEmail.sendSliceSealForm", {
					mailArr: recipientChangeArr,
				});
			}
		}

		//Added the isOld status for remaining recipients
		// const pendingRecipients = recipientsDetails
		// 	?.filter(
		// 		(recipient) =>
		// 			(recipient.status === "pending" ||
		// 				recipient.status === "mailed" ||
		// 				recipient.status === "viewed" ||
		// 				recipient.status === "bounced") &&
		// 			remainingRecipientWithoutDeletedUsers.some(
		// 				(data) => data.id === recipient.id
		// 			)
		// 	)
		// 	.filter(
		// 		(r) =>
		// 			!sameRecipientsWithDifferentRole.some(
		// 				(sr) => sr.id === r.id
		// 			)
		// 	)
		// 	.map((recipient) => ({
		// 		...recipient,
		// 		isOld: true,
		// 		isDraftUser: oldFormData.status === "draft" ? true : false,
		// 	}));

		// const newRecipientWithDifferentRole =
		// 	sameRecipientsWithDifferentRole?.map((r) => ({
		// 		...r,
		// 		isNew: true,
		// 	}));

		// const mergedNewRecipients = [
		// 	...newRecipientWithDifferentRole,
		// 	...newRecipients,
		// ];

		// we checked the merged new recipients and changed recipient array and if the email is same then we update the status of the merged new recipients
		// const mergedNewRecipientsArr = mergedNewRecipients.map((r) => {
		// 	const matchedChanged = changedRecipientArr.find(
		// 		(rc) => rc.email === r.email
		// 	);
		// 	if (matchedChanged) {
		// 		return {
		// 			...r,
		// 			status: matchedChanged.status,
		// 		};
		// 	} else {
		// 		return r;
		// 	}
		// });

		if (oldFormData?.status === "draft") {
			return {
				recipientsDetails: recipientsDetails.map((r) => ({
					...r,
					isNew: true,
				})),
				fileDetails: { file_name: title },
			};
		}

		return {
			recipientsDetails: [...newUpdatedRecipientsDetails],
			fileDetails: { file_name: title },
			historyArr,
		};

		// so we check
	} catch (error) {
		console.log(error);
		return recipientsDetails;
	}
}

// function updatedStatusBasedOnPriority(changedRecipients, recipientsDetails) {
// 	try {
// 		// now we used recipientsDetails and removed the completed status user
// 		const filteredRecipientsDetails = recipientsDetails.filter(
// 			(r) => r.status !== "completed"
// 		);

// 		// get the lowest priority signer index in the filteredRecipientsDetails array
// 		const lowestPrioritySignerIndex = filteredRecipientsDetails.findIndex(
// 			(r) => r.role === "signer" && r.status !== "completed"
// 		);

// 		// find the signer which has lower priority in the changedRecipients array
// 		const signerWithLowestPriority = changedRecipients.find(
// 			(r) => r.role === "signer" && r.status !== "completed"
// 		);

// 		// now we find the index of the signerWithLowestPriority in the filteredRecipientsDetails array
// 		const signerWithLowestPriorityIndex =
// 			filteredRecipientsDetails.findIndex(
// 				(r) => r.email === signerWithLowestPriority?.email
// 			) || 0;

// 		if (lowestPrioritySignerIndex >= signerWithLowestPriorityIndex) {
// 			// now we update the status of the users in the filteredRecipientsDetails array
// 			const updatedRecipients = filteredRecipientsDetails.map(
// 				(r, index) => {
// 					if (index < lowestPrioritySignerIndex) {
// 						return { ...r, status: "mailed" };
// 					}
// 					if (index === lowestPrioritySignerIndex) {
// 						return { ...r, status: "mailed" };
// 					}
// 					if (index > lowestPrioritySignerIndex) {
// 						return { ...r, status: "pending" };
// 					}
// 				}
// 			);
// 			return updatedRecipients;
// 		}
// 		if (lowestPrioritySignerIndex < signerWithLowestPriorityIndex) {
// 			// right side array will get pending status

// 			const updatedRecipients = filteredRecipientsDetails.map(
// 				(r, index) => {
// 					if (index > signerWithLowestPriorityIndex) {
// 						return { ...r, status: "pending" };
// 					}
// 				}
// 			);
// 			return updatedRecipients;
// 		}

// 		// return updatedRecipients;
// 	} catch (err) {
// 		console.log(err);
// 	}
// }
function updateRecipientDetailsBasedOnPriorityInArray(
	recipientsDetails,
	isPriorityRequired,
	formStatus
) {
	try {
		const newRecipients = recipientsDetails.filter(
			(r) => r?.status !== "completed"
		);
		// sort data based on the priority
		const sortedArray = newRecipients.sort(
			(a, b) => a.r_priority - b.r_priority
		);
		if (isPriorityRequired) {
			// find the first signer which has status mailed or not status key in  object
			let firstSigner = sortedArray.find((r) => r.role === "signer");

			// if first signer is not present it means flow stopped at bounced status user
			if (!firstSigner) {
				firstSigner = sortedArray.find((r) => r.status === "bounced");
			}

			if (!firstSigner) {
				// it means no signer is present in the array it means last users are viewer
				// so we will update the status of the viewers to pending
				const updatedArray = sortedArray.map((r) => {
					if (r.role === "viewer") {
						return {
							...r,
							status: "mailed",
							...(r?.status ? { isOld: true } : { isNew: true }),
							...(formStatus === "draft"
								? { isDraftUser: true }
								: {}),
						};
					}
					return r;
				});
				return updatedArray;
			}

			// now this is our pointer position
			const pointerPosition = sortedArray.findIndex(
				(r) => r.email === firstSigner?.email
			);

			// now we will update the status of the recipients based on the pointer position
			//left side of pointer position will be mailed and right side of pointer position will be pending
			const updatedArray = sortedArray.map((r, index) => {
				// if (r?.status === "completed") {
				// 	return r;
				// }

				if (index <= pointerPosition) {
					// if status is not present then we will isNew to true
					return {
						...r,
						status: "mailed",
						...(r?.status ? { isOld: true } : { isNew: true }),
						...(formStatus === "draft"
							? { isDraftUser: true }
							: {}),
					};
				}
				if (index > pointerPosition) {
					return {
						...r,
						status: "pending",
						...(r?.status ? { isOld: true } : { isNew: true }),
						...(formStatus === "draft"
							? { isDraftUser: true }
							: {}),
					};
				}
			});
			return updatedArray;
		} else {
			const updatedArray = sortedArray.map((r, index) => {
				// if (r?.status === "completed") {
				// 	return r;
				// }

				return {
					...r,
					status: "mailed",
					...(r?.status ? { isOld: true } : { isNew: true }),
					...(formStatus === "draft" ? { isDraftUser: true } : {}),
				};
			});

			return updatedArray;
		}
	} catch (err) {
		console.log(err);
	}
}

module.exports = {
	editPdf,
	getUserFields,
	validateFormToken,
	fillFormFields,
	getAllSubmissions,
	sendEmailReminder,
	removeFilesOfDeletedForms,
	getAllFiles,
	deleteFile,
	uploadPdfFile,
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
	selfSign,
};
