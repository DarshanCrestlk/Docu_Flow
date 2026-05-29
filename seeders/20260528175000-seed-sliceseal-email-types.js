"use strict";

/** @type {import('sequelize-cli').Migration} */

function toLabelKey(name) {
	return name
		.toLowerCase()
		.replace(/\(|\)/g, "")
		.trim()
		.replace(/\s+/g, "_");
}

function buildEmailTypes(companyId, now) {
	const base = [
		{
			name: "Document Sign Request",
			email_slugs: [
				{ label: "Sender Name", value: "${sender_name}" },
				{ label: "Recipient Name", value: "${recipient_name}" },
				{ label: "Document Name", value: "${document_name}" },
			],
		},
		{
			name: "Document Viewer",
			email_slugs: [
				{ label: "Sender Name", value: "${sender_name}" },
				{ label: "Recipient Name", value: "${recipient_name}" },
				{ label: "Document Name", value: "${document_name}" },
			],
		},
		{
			name: "Document Signed by All Recipients",
			email_slugs: [
				{ label: "Username", value: "${user_name}" },
				{ label: "Document Name", value: "${document_name}" },
			],
		},
		{
			name: "Reminder to Sign Document",
			email_slugs: [
				{ label: "Sender Name", value: "${sender_name}" },
				{ label: "Recipient Name", value: "${recipient_name}" },
				{ label: "Document Name", value: "${document_name}" },
				{ label: "Expiration Date", value: "${expiration_date}" },
			],
		},
		{
			name: "Document Link Expired",
			email_slugs: [
				{ label: "Sender Name", value: "${sender_name}" },
				{ label: "Document Name", value: "${document_name}" },
				{ label: "Recipient Status", value: "${recipient_status}" },
			],
		},
		{
			name: "Document Voided",
			email_slugs: [
				{ label: "Sender Name", value: "${sender_name}" },
				{ label: "Sender Email", value: "${sender_email}" },
				{ label: "Username", value: "${user_name}" },
				{ label: "Document Name", value: "${document_name}" },
				{ label: "Void Reason", value: "${reason_for_void}" },
			],
		},
		{
			name: "Document Deleted",
			email_slugs: [
				{ label: "Sender Name", value: "${sender_name}" },
				{ label: "Sender Email", value: "${sender_email}" },
				{ label: "Username", value: "${user_name}" },
				{ label: "Document Name", value: "${document_name}" },
				{ label: "Delete Reason", value: "${reason_for_deletion}" },
			],
		},
		{
			name: "Document Resend",
			email_slugs: [
				{ label: "Sender Name", value: "${sender_name}" },
				{ label: "Recipient Name", value: "${recipient_name}" },
				{ label: "Document Name", value: "${document_name}" },
			],
		},
		{
			name: "Recipient Removed",
			email_slugs: [
				{ label: "Sender Name", value: "${sender_name}" },
				{ label: "Sender Email", value: "${sender_email}" },
				{ label: "Recipient Name", value: "${recipient_name}" },
				{ label: "Document Name", value: "${document_name}" },
			],
		},
		{
			name: "Recipient Added",
			email_slugs: [
				{ label: "Recipient Name", value: "${recipient_name}" },
				{ label: "Document Name", value: "${document_name}" },
				{ label: "Sender Name", value: "${sender_name}" },
			],
		},
		{
			name: "Document Declined by Recipient",
			email_slugs: [
				{ label: "Username", value: "${user_name}" },
				{
					label: "Declining Recipient Name",
					value: "${declining_recipient_name}",
				},
				{ label: "Document Name", value: "${document_name}" },
				{ label: "Decline Reason", value: "${reason_for_decline}" },
			],
		},
		{
			name: "Undeliverable Document",
			email_slugs: [
				{ label: "Sender Name", value: "${sender_name}" },
				{ label: "Document Name", value: "${document_name}" },
				{ label: "Invalid Email", value: "${bounce_email}" },
			],
		},
		{
			name: "Reminder to Sign Document Forever",
			email_slugs: [
				{ label: "Sender Name", value: "${sender_name}" },
				{ label: "Recipient Name", value: "${recipient_name}" },
				{ label: "Document Name", value: "${document_name}" },
			],
		},
	];

	return base.map((item) => ({
		company_id: companyId,
		name: item.name,
		label_key: toLabelKey(item.name),
		email_slugs: JSON.stringify(item.email_slugs),
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
			const rows = buildEmailTypes(company.id, now);

			const existing = await queryInterface.sequelize.query(
				"SELECT label_key FROM pdf_form_email_types WHERE company_id = :company_id",
				{
					replacements: { company_id: company.id },
					type: queryInterface.sequelize.QueryTypes.SELECT,
				}
			);
			const existingKeys = new Set(existing.map((x) => x.label_key));

			const toInsert = rows.filter((row) => !existingKeys.has(row.label_key));
			if (toInsert.length) {
				await queryInterface.bulkInsert("pdf_form_email_types", toInsert, {});
			}
		}
	},

	async down(queryInterface) {
		await queryInterface.bulkDelete("pdf_form_email_types", null, {});
	},
};
