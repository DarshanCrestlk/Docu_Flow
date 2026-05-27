const usersModel = require("../../../services/users/models/users.model");
const companiesModel = require("../../../services/companies/models/companies.model");

const pdfFormsModel = require("../../../services/pdfForms/models/pdfForms.model");
const pdfFormFilesModel = require("../../../services/pdfForms/models/pdfFormFiles.model");
const pdfFormRecipientsModel = require("../../../services/pdfForms/models/pdfFormRecipients.model");
const pdfFormFieldsModel = require("../../../services/pdfForms/models/pdfFormFields.model");
const pdfFieldsOptionsModel = require("../../../services/pdfForms/models/pdfFieldsOptions.model");
const pdfFormRadioButtonsModel = require("../../../services/pdfForms/models/pdfFormRadioButtons.model");
const pdfFormHistoryModel = require("../../../services/pdfForms/models/pdfFormHistory.model");
const pdfTagsModel = require("../../../services/pdfForms/models/pdfTags.model");
const pdfFormTagsModel = require("../../../services/pdfForms/models/pdfFormTags.model");
const pdfFormReminderLogsModel = require("../../../services/pdfForms/models/pdfFormReminderLogs.model");
const pdfFormRevokedUsersModel = require("../../../services/pdfForms/models/pdfFormRevokedUsers.model");
const pdfFormSignatureInitialsModel = require("../../../services/pdfForms/models/pdfFormSignatureInitials.model");

function defineModel(sequelize, def) {
	return sequelize.define(def.name, def.define, def.options);
}

module.exports = (sequelize) => {
	const models = {
		companies: defineModel(sequelize, companiesModel),
		users: defineModel(sequelize, usersModel),

		pdfFormFiles: defineModel(sequelize, pdfFormFilesModel),
		pdfForms: defineModel(sequelize, pdfFormsModel),
		pdfFormRecipients: defineModel(sequelize, pdfFormRecipientsModel),
		pdfFormFields: defineModel(sequelize, pdfFormFieldsModel),
		pdfFieldsOptions: defineModel(sequelize, pdfFieldsOptionsModel),
		pdfFormRadioButtons: defineModel(sequelize, pdfFormRadioButtonsModel),
		pdfFormHistory: defineModel(sequelize, pdfFormHistoryModel),
		pdfTags: defineModel(sequelize, pdfTagsModel),
		pdfFormTags: defineModel(sequelize, pdfFormTagsModel),
		pdfFormReminderLogs: defineModel(sequelize, pdfFormReminderLogsModel),
		pdfFormRevokedUsers: defineModel(sequelize, pdfFormRevokedUsersModel),
		pdfFormSignatureInitials: defineModel(sequelize, pdfFormSignatureInitialsModel),
	};

	// Core / tenant relations
	models.companies.hasMany(models.users, { foreignKey: "company_id" });
	models.users.belongsTo(models.companies, { foreignKey: "company_id" });

	// PDF / e-sign domain relations
	models.companies.hasMany(models.pdfFormFiles, { foreignKey: "company_id" });
	models.pdfFormFiles.belongsTo(models.companies, { foreignKey: "company_id" });
	models.pdfFormFiles.belongsTo(models.users, { foreignKey: "created_by" });
	models.users.hasMany(models.pdfFormFiles, { foreignKey: "created_by" });

	models.companies.hasMany(models.pdfForms, { foreignKey: "company_id" });
	models.pdfForms.belongsTo(models.companies, { foreignKey: "company_id" });
	models.pdfForms.belongsTo(models.pdfFormFiles, { foreignKey: "file_id" });
	models.pdfFormFiles.hasMany(models.pdfForms, { foreignKey: "file_id" });
	models.pdfForms.belongsTo(models.users, { foreignKey: "created_by" });
	models.users.hasMany(models.pdfForms, { foreignKey: "created_by" });

	models.companies.hasMany(models.pdfFormRecipients, {
		foreignKey: "company_id",
	});
	models.pdfFormRecipients.belongsTo(models.companies, {
		foreignKey: "company_id",
	});
	models.pdfForms.hasMany(models.pdfFormRecipients, {
		foreignKey: "form_id",
	});
	models.pdfFormRecipients.belongsTo(models.pdfForms, {
		foreignKey: "form_id",
	});
	models.pdfFormRecipients.belongsTo(models.users, { foreignKey: "user_id" });
	models.users.hasMany(models.pdfFormRecipients, { foreignKey: "user_id" });

	models.companies.hasMany(models.pdfFormFields, { foreignKey: "company_id" });
	models.pdfFormFields.belongsTo(models.companies, { foreignKey: "company_id" });
	models.pdfForms.hasMany(models.pdfFormFields, { foreignKey: "form_id" });
	models.pdfFormFields.belongsTo(models.pdfForms, { foreignKey: "form_id" });
	models.pdfFormRecipients.hasMany(models.pdfFormFields, {
		foreignKey: "form_recipient_id",
	});
	models.pdfFormFields.belongsTo(models.pdfFormRecipients, {
		foreignKey: "form_recipient_id",
	});

	models.companies.hasMany(models.pdfFieldsOptions, {
		foreignKey: "company_id",
	});
	models.pdfFieldsOptions.belongsTo(models.companies, {
		foreignKey: "company_id",
	});
	models.pdfFormFields.hasMany(models.pdfFieldsOptions, {
		foreignKey: "field_id",
	});
	models.pdfFieldsOptions.belongsTo(models.pdfFormFields, {
		foreignKey: "field_id",
	});

	models.companies.hasMany(models.pdfFormRadioButtons, {
		foreignKey: "company_id",
	});
	models.pdfFormRadioButtons.belongsTo(models.companies, {
		foreignKey: "company_id",
	});
	models.pdfFormFields.hasMany(models.pdfFormRadioButtons, {
		foreignKey: "field_id",
	});
	models.pdfFormRadioButtons.belongsTo(models.pdfFormFields, {
		foreignKey: "field_id",
	});

	models.companies.hasMany(models.pdfFormHistory, { foreignKey: "company_id" });
	models.pdfFormHistory.belongsTo(models.companies, {
		foreignKey: "company_id",
	});
	models.pdfForms.hasMany(models.pdfFormHistory, { foreignKey: "form_id" });
	models.pdfFormHistory.belongsTo(models.pdfForms, { foreignKey: "form_id" });
	models.pdfFormHistory.belongsTo(models.users, { foreignKey: "performed_by" });
	models.users.hasMany(models.pdfFormHistory, { foreignKey: "performed_by" });

	models.companies.hasMany(models.pdfTags, { foreignKey: "company_id" });
	models.pdfTags.belongsTo(models.companies, { foreignKey: "company_id" });
	models.pdfTags.belongsTo(models.users, { foreignKey: "user_id" });
	models.users.hasMany(models.pdfTags, { foreignKey: "user_id" });

	models.companies.hasMany(models.pdfFormTags, { foreignKey: "company_id" });
	models.pdfFormTags.belongsTo(models.companies, { foreignKey: "company_id" });
	models.pdfTags.hasMany(models.pdfFormTags, { foreignKey: "pdf_tag_id" });
	models.pdfFormTags.belongsTo(models.pdfTags, { foreignKey: "pdf_tag_id" });
	models.pdfForms.hasMany(models.pdfFormTags, { foreignKey: "pdf_form_id" });
	models.pdfFormTags.belongsTo(models.pdfForms, { foreignKey: "pdf_form_id" });

	models.companies.hasMany(models.pdfFormReminderLogs, {
		foreignKey: "company_id",
	});
	models.pdfFormReminderLogs.belongsTo(models.companies, {
		foreignKey: "company_id",
	});
	models.pdfForms.hasMany(models.pdfFormReminderLogs, {
		foreignKey: "form_id",
	});
	models.pdfFormReminderLogs.belongsTo(models.pdfForms, {
		foreignKey: "form_id",
	});

	models.companies.hasMany(models.pdfFormRevokedUsers, {
		foreignKey: "company_id",
	});
	models.pdfFormRevokedUsers.belongsTo(models.companies, {
		foreignKey: "company_id",
	});
	models.pdfForms.hasMany(models.pdfFormRevokedUsers, {
		foreignKey: "form_id",
	});
	models.pdfFormRevokedUsers.belongsTo(models.pdfForms, {
		foreignKey: "form_id",
	});

	models.companies.hasMany(models.pdfFormSignatureInitials, {
		foreignKey: "company_id",
	});
	models.pdfFormSignatureInitials.belongsTo(models.companies, {
		foreignKey: "company_id",
	});
	models.users.hasMany(models.pdfFormSignatureInitials, {
		foreignKey: "user_id",
	});
	models.pdfFormSignatureInitials.belongsTo(models.users, {
		foreignKey: "user_id",
	});

	return models;
};