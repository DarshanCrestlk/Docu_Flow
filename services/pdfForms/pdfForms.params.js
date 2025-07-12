/**
 * @typedef {import("fastest-validator").ValidationSchema} ValidationSchema
 * @typedef {import("fastest-validator").ValidationRule} ValidationRule
 */

const { strict } = require("assert");

// Common Validation Objects
const idValidationObj = {
	type: "number",
	optional: false,
	min: 1,
	max: 1000000000,
	integer: true,
	convert: true,
};

const stringValidationObj = {
	type: "string",
	min: 1,
	max: 255,
	convert: true,
};

const booleanValidationObj = {
	type: "boolean",
	optional: true,
	default: false,
	convert: true,
};

const emailValidationObj = {
	type: "email",
	optional: false,
	min: 1,
	max: 255,
	convert: true,
};

const dateValidationObj = {
	type: "date",
	optional: true,
	convert: true,
};

const paginationParams = {
	limit: {
		type: "number",
		enum: [25, 50, 100],
		optional: true,
		default: 10,
		convert: true,
	},
	order: {
		type: "string",
		enum: ["ASC", "DESC"],
		optional: true,
		default: "ASC",
		convert: true,
	},
	page: {
		type: "number",
		optional: true,
		default: 1,
		max: 1000,
		min: 1,
		convert: true,
	},
};

// Common Schemas
const strictSchema = { $$strict: true };
const optionalString = { ...stringValidationObj, optional: true, min: 0 };

// Validation Schemas
const sendReminderParams = { id: idValidationObj, ...strictSchema };
const sendResendParams = { id: idValidationObj, ...strictSchema };
const voidFormParams = {
	formId: idValidationObj,
	reason: stringValidationObj,
	...strictSchema,
};
const deleteFormParams = {
	id: idValidationObj,
	reason_for_deletion: { ...stringValidationObj, min: 0, max: 255 },
	...strictSchema,
};
const saveToTemplateParams = { id: idValidationObj, ...strictSchema };
const getAllFieldsParams = {
	id: idValidationObj,
	mode: {
		type: "string",
		optional: false,
		enum: ["form", "template"],
	},
	checkFormStatus: booleanValidationObj,
	...strictSchema,
};
const deleteTemplateParams = { id: idValidationObj, ...strictSchema };
const deleteFileFromS3Params = {
	fileKey: { ...stringValidationObj, max: 500 },
	...strictSchema,
};
const addFormTagsParams = {
	tag_name: stringValidationObj,
	uuid_file_id: { ...stringValidationObj, optional: true, min: 0, max: 100 },
	...strictSchema,
};
const checkIfTemplateExistsParams = {
	id: { ...idValidationObj, optional: true },
	title: { ...stringValidationObj, optional: true },
};
const declineFormParams = {
	reason_for_declining: stringValidationObj,
	token: { ...stringValidationObj, max: 50 },
	...strictSchema,
};
const validateFormTokenParams = {
	token: { ...stringValidationObj, max: 50 },
	browser_details: optionalString,
	...strictSchema,
};
const activityHistoryParams = {
	id: idValidationObj,
	...paginationParams,
	sortBy: {
		type: "string",
		optional: true,
		default: "createdAt",
		enum: ["createdAt"],
		convert: true,
	},
	...strictSchema,
};
const getUserFieldsParams = {
	token: { ...stringValidationObj, max: 50 },
	...strictSchema,
};
const updateRecipientStatusParams = {
	data: [
		{
			type: "array",
			optional: false,
			empty: false,
			items: {
				type: "object",
				props: {
					formId: idValidationObj,
					companyId: { ...idValidationObj, optional: true },
					email: emailValidationObj,
					role: {
						type: "string",
						enum: ["signer", "viewer"],
						optional: true,
						...stringValidationObj,
					},
					MessageId: optionalString,
					ResponseMetadata: {
						type: "object",
						optional: true,
						strict: false,
					},
				},
			},
		},
		optionalString,
	],
	event: {
		type: "string",
		optional: false,
		enum: ["send", "bounced"],
	},
	company_id: { ...idValidationObj, optional: true },
	...strictSchema,
};
const verifyPdfTokenParams = { $$strict: false };
const uploadPdfParams = {
	files: {
		type: "array",
		min: 1,
		optional: false,
		convert: true,
		strict: false,
		items: {
			type: "object",
			props: {
				filename: stringValidationObj,
				key: stringValidationObj,
				size: idValidationObj,
			},
		},
	},
	company_id: idValidationObj,
	...strictSchema,
};
const checkDuplicateFilesParams = {
	fileName: stringValidationObj,
	company_id: idValidationObj,
	...strictSchema,
};
const fillFormParams = { $$strict: true };
const editPdfParams = {
	formData: {
		type: "object",
		optional: true,
		props: {
			attach_audit_log: booleanValidationObj,
			expiration_date: dateValidationObj,
			expiration_days: { ...idValidationObj, optional: true },
			form_id: { ...idValidationObj, optional: true },
			isDraft: booleanValidationObj,
			isInitiate: booleanValidationObj,
			is_protected: booleanValidationObj,
			mode: {
				type: "string",
				optional: true,
				enum: ["duplicate", "edit", "create", "initiate"],
			},
			note: { ...optionalString },
			priorityRequired: booleanValidationObj,
			reminder_days: {
				type: "number",
				optional: true,
				default: 0,
				min: 0,
				max: 255,
				convert: true,
			},
			selectionFrom: {
				type: "string",
				optional: true,
				enum: ["form", "template"],
			},
			title: optionalString,
			validity_type: {
				type: "string",
				optional: true,
				enum: ["days", "date", "forever"],
			},
			tags: {
				type: "array",
				optional: true,
				items: { type: "number", optional: true, min: 0 },
				min: 0,
			},
			thumbnail_key: optionalString,
			thumbnail_url: optionalString,
			recipients: {
				type: "array",
				optional: true,
				items: {
					type: "object",
					props: {
						color: stringValidationObj,
						company_id: { ...idValidationObj, optional: true },
						disabled: booleanValidationObj,
						email: emailValidationObj,
						form_id: { ...idValidationObj, optional: true },
						id: idValidationObj,
						index: { ...idValidationObj, optional: true, min: 0 },
						is_changed: booleanValidationObj,
						is_declined: booleanValidationObj,
						message_id: optionalString,
						name: stringValidationObj,
						recipient_id: { ...idValidationObj, optional: true },
						role: {
							type: "string",
							enum: ["signer", "viewer"],
							convert: true,
							optional: true,
						},
						type: {
							type: "string",
							enum: [
								"inside_organization",
								"outside_organization",
							],
							convert: true,
							optional: true,
						},
						password: optionalString,
						user_id: { ...idValidationObj, optional: true },
						value: { ...idValidationObj, optional: true, min: 0 },
						r_priority: {
							...idValidationObj,
							optional: true,
							min: 0,
						},
						reason_for_declining: optionalString,
						recipient_order: {
							...idValidationObj,
							optional: true,
							min: 0,
						},
						status: {
							type: "string",
							optional: true,
							enum: [
								"pending",
								"mailed",
								"viewed",
								"completed",
								"revoked",
								"void",
								"expired",
								"bounced",
							],
						},
						token: optionalString,
						updatedAt: dateValidationObj,
						user: {
							type: "object",
							optional: true,
							props: {
								id: idValidationObj,
								full_name: stringValidationObj,
								profile_bg_color: optionalString,
								profile_pic: optionalString,
							},
						},
						viewedAt: dateValidationObj,
						fields: {
							type: "array",
							optional: true,
							items: {
								type: "object",
								props: {
									uuid_field_id: stringValidationObj,
									type: {
										type: "string",
										enum: [
											"checkbox",
											"text",
											"signature",
											"digital signature",
											"date",
											"dropdown",
											"radio",
											"full_name",
											"signed_date",
											"email_id",
											"company",
											"title",
											"initial",
											"number",
										], // update as per app
										optional: true,
									},
									is_required: booleanValidationObj,
									field_label: optionalString,
									character_limit: {
										type: "number",
										optional: true,
										min: 0,
									},
									date_format: optionalString,
									default_value: {
										...optionalString,
										min: 0,
									},
									tooltip: { ...optionalString, min: 0 },
									font_size: {
										type: "number",
										optional: true,
									},
									x_coordinate: {
										type: "number",
										optional: true,
									},
									y_coordinate: {
										type: "number",
										optional: true,
									},
									width: { type: "number", optional: true },
									height: { type: "number", optional: true },
									pageIndex: {
										type: "number",
										optional: true,
									},
									zoom_x: { type: "number", optional: true },
									zoom_y: { type: "number", optional: true },
									scale_x: { type: "number", optional: true },
									scale_y: { type: "number", optional: true },
									fill: optionalString,
									font_family: optionalString,
									recipient: {
										type: "number",
										optional: true,
									},
								},
							},
						},
					},
				},
				strict: false,
			},
			key: {
				type: "string",
				optional: true,
				min: 1,
				max: 255,
				convert: true,
			},
			emailSlugs: {
				type: "array",
				optional: true,
				items: {
					type: "object",
					props: {
						label: optionalString,
						value: optionalString,
					},
				},
			},
			size: { ...idValidationObj, optional: true },
			email_subject: optionalString,
			email_template: { ...optionalString, optional: true, max: 10000 },
			file_name: optionalString,
			file_url: optionalString,
		},
		...strictSchema,
	},
};

const extendExpirationDateParams = {
	id: idValidationObj,
	newExpirationDate: dateValidationObj,
	...strictSchema,
};

const getUserSignatureParams = {
	id: idValidationObj,
	email: emailValidationObj,
	...strictSchema,
};

// Export Schemas
module.exports = {
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
};
