"use strict";

/** @type {import('sequelize-cli').Migration} */

function toLabelKey(name) {
	return name
		.toLowerCase()
		.replace(/\(|\)/g, "")
		.trim()
		.replace(/\s+/g, "_");
}

function buildTemplateSeed(companyId, now) {
	const base = [
		{
			name: "Document Sign Request",
			mail_subject: "Action Required: Sign Document - ${document_name}",
			description:
				"Notification email sent to recipients requesting them to sign a document.",
			email_template: `<p>Dear <strong>\${recipient_name}</strong>,</p>
		<p>You have been requested to sign the document, <strong>\${document_name}, </strong>sent by <strong>\${sender_name}</strong>.</p>
		<p>Please click above to review and complete the signature process.</p>
		<p>Best Regards,<br><strong>Compliance Team</strong></p>`,
		},
		{
			name: "Document Viewer",
			mail_subject: "Document Available for Viewing: ${document_name}",
			description:
				"Notification email sent to viewers when a document is available for viewing.",
			email_template: `<p>Dear <strong>\${recipient_name}</strong>,</p>
		<p>The document <strong>\${document_name}</strong> has been shared with you for viewing by <strong>\${sender_name}</strong>.</p>
		<p>Please click above to view the document.</p>
		<p>Best Regards,<br><strong>Compliance Team</strong></p>`,
		},
		{
			name: "Document Signed by All Recipients",
			mail_subject: "Document Fully Signed: ${document_name}",
			description: "Notification email sent when a document is fully signed.",
			email_template: `<p>Dear <strong>\${user_name}</strong>,</p>
		<p>The document <strong>\${document_name}</strong> has been signed and completed.</p>
		<p>Please click above to view the signed document.</p>
		<p>Best Regards,<br><strong>Compliance Team</strong></p>`,
		},
		{
			name: "Reminder to Sign Document",
			mail_subject: "Reminder: Please Sign Document - ${document_name}",
			description: "Reminder email sent to unsigned recipients.",
			email_template: `<p>Dear <strong>\${recipient_name}</strong>,</p>
		<p>This is a friendly reminder to sign the document <strong>\${document_name}</strong> sent by <strong>\${sender_name}</strong>.</p>
		<p>Please note that the document link will expire on <strong>\${expiration_date}</strong>.</p>
		<p>Please click above to review and complete the signature process at your earliest convenience.</p>
		<p>Best Regards,<br><strong>Compliance Team</strong></p>`,
		},
		{
			name: "Document Link Expired",
			mail_subject: "Document Expired: ${document_name}",
			description:
				"Notification email sent when a document link has expired.",
			email_template: `<p>Dear <strong>\${sender_name}</strong>,</p>
		<p>The link for the document <strong>\${document_name}</strong> has expired and is no longer accessible for signing.</p>
		<p>Recipient Status: <strong>\${recipient_status}</strong></p>
		<p>Best Regards,<br><strong>Compliance Team</strong></p>`,
		},
		{
			name: "Document Voided",
			mail_subject: "Notification: Document Voided - ${document_name}",
			description:
				"Notification email sent when a document is voided by the sender.",
			email_template: `<p>Dear <strong>\${user_name}</strong>,</p>
		<p>The document <strong>\${document_name}</strong> has been voided by <strong>\${sender_name}</strong> and is no longer valid.</p>
		<p><ul><li>Reason for Voiding: <strong>\${reason_for_void}</strong></li></ul></p>
		<p>If you have any questions or need further information, please contact the sender at <strong>\${sender_email}</strong>.</p>
		<p>Best Regards,<br><strong>Compliance Team</strong></p>`,
		},
		{
			name: "Document Deleted",
			mail_subject: "Notification: Document Deleted - ${document_name}",
			description:
				"Notification email sent when a document is deleted by the sender.",
			email_template: `<p>Dear <strong>\${user_name}</strong>,</p>
		<p>The document <strong>\${document_name}</strong> has been deleted by <strong>\${sender_name}</strong> and is no longer available.</p>
		<p><ul><li>Reason for Deletion: <strong>\${reason_for_deletion}</strong></li></ul></p>
		<p>If you have any questions or need further information, please contact the sender at <strong>\${sender_email}</strong>.</p>
		<p>Best Regards,<br><strong>Compliance Team</strong></p>`,
		},
		{
			name: "Document Resend",
			mail_subject:
				"Action Required: Document Resent for Signature - ${document_name}",
			description:
				"Notification email sent when a document is resent for signature.",
			email_template: `<p>Dear <strong>\${recipient_name}</strong>,</p>
		<p>The document <strong>\${document_name}</strong> has been resent to you by <strong>\${sender_name}</strong> for signing.</p>
		<p>Please click above to review and complete the signature process at your earliest convenience.</p>
		<p>Best Regards,<br><strong>Compliance Team</strong></p>`,
		},
		{
			name: "Recipient Removed",
			mail_subject: "Document Access Revoked: ${document_name}",
			description:
				"Notification email sent when a recipient is removed from a document.",
			email_template: `<p>Dear <strong>\${recipient_name}</strong>,</p>
		<p>You have been removed from the recipient list for the document <strong>\${document_name}</strong> sent by <strong>\${sender_name}</strong>.</p>
		<p>As a result, you no longer have access to this document, and no further action is required.</p>
		<p>If you have any questions or need further information, please contact the sender at <strong>\${sender_email}</strong>.</p>
		<p>Best Regards,<br><strong>Compliance Team</strong></p>`,
		},
		{
			name: "Document Declined by Recipient",
			mail_subject:
				"Notification: Document Declined by ${declining_recipient_name} - ${document_name}",
			description:
				"Notification email sent when a recipient declines to sign a document.",
			email_template: `<p>Dear <strong>\${user_name}</strong>,</p>
		<p>The document <strong>\${document_name}</strong> was declined for signing by <strong>\${declining_recipient_name}</strong>.</p>
		<p><ul><li>Reason for Decline: <strong>\${reason_for_decline}</strong></li></ul></p>
		<p>Best Regards,<br><strong>Compliance Team</strong></p>`,
		},
		{
			name: "Undeliverable Document",
			mail_subject: "Action Required: Undeliverable Document - ${document_name}",
			description:
				"Notification email sent when a document cannot be delivered due to an invalid recipient email.",
			email_template: `<p>Dear <strong>\${sender_name}</strong>,</p>
		<p>The document <strong>\${document_name}</strong>, sent to <strong>\${bounce_email}</strong>, could not be delivered because the email address appears to be invalid or incorrect.</p>
		<p>Please review the email address and take the necessary action.</p>
		<p>Best Regards,<br><strong>Compliance Team</strong></p>`,
		},
		{
			name: "Reminder to Sign Document Forever",
			mail_subject: "Reminder: Please Sign Document - ${document_name}",
			description: "Reminder email sent to unsigned recipients.",
			email_template: `<p>Dear <strong>\${recipient_name}</strong>,</p>
		<p>This is a friendly reminder to sign the document <strong>\${document_name}</strong> sent by <strong>\${sender_name}</strong>.</p>
		<p>Please click above to review and complete the signature process at your earliest convenience.</p>
		<p>Best Regards,<br><strong>Compliance Team</strong></p>`,
		},
	];

	return base.map((item) => ({
		company_id: companyId,
		name: item.name,
		label_key: toLabelKey(item.name),
		mail_subject: item.mail_subject,
		description: item.description,
		email_template: item.email_template,
		createdAt: now,
		updatedAt: now,
	}));
}

module.exports = {
	async up(queryInterface) {
		const now = new Date();

		const companies = await queryInterface.sequelize.query(
			"SELECT id FROM companies",
			{ type: queryInterface.sequelize.QueryTypes.SELECT }
		);

		if (!companies.length) return;

		for (const company of companies) {
			const typeRows = await queryInterface.sequelize.query(
				"SELECT id, label_key FROM pdf_form_email_types WHERE company_id = :company_id",
				{
					replacements: { company_id: company.id },
					type: queryInterface.sequelize.QueryTypes.SELECT,
				}
			);
			if (!typeRows.length) continue;

			const typeMap = new Map(typeRows.map((row) => [row.label_key, row.id]));

			const existingTemplateRows = await queryInterface.sequelize.query(
				"SELECT label_key FROM pdf_form_email_templates WHERE company_id = :company_id",
				{
					replacements: { company_id: company.id },
					type: queryInterface.sequelize.QueryTypes.SELECT,
				}
			);
			const existingKeys = new Set(
				existingTemplateRows.map((row) => row.label_key)
			);

			const templateRows = buildTemplateSeed(company.id, now)
				.filter((item) => typeMap.has(item.label_key))
				.filter((item) => !existingKeys.has(item.label_key))
				.map((item) => ({
					...item,
					email_type: typeMap.get(item.label_key),
				}));

			if (templateRows.length) {
				await queryInterface.bulkInsert(
					"pdf_form_email_templates",
					templateRows,
					{}
				);
			}
		}
	},

	async down(queryInterface) {
		await queryInterface.bulkDelete("pdf_form_email_templates", null, {});
	},
};
