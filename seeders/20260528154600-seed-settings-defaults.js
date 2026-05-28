"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		const now = new Date();
		const companies = await queryInterface.sequelize.query(
			"SELECT id FROM companies",
			{ type: queryInterface.sequelize.QueryTypes.SELECT }
		);

		if (!companies.length) return;

		const existing = await queryInterface.sequelize.query(
			"SELECT company_id FROM settings",
			{ type: queryInterface.sequelize.QueryTypes.SELECT }
		);
		const existingCompanyIds = new Set(existing.map((r) => r.company_id));

		const rows = companies
			.filter((company) => !existingCompanyIds.has(company.id))
			.map((company) => ({
				company_id: company.id,
				reminder_days: 3,
				session_timeout_for_recipient: 30,
				show_signer_name: true,
				show_signer_datetime: true,
				show_signer_ip: true,
				show_signer_id: false,
				date_format: "MM-DD-YYYY",
				time_format: "12-Hours",
				document_id_prefix: "DOC",
				createdAt: now,
				updatedAt: now,
			}));

		if (rows.length) {
			await queryInterface.bulkInsert("settings", rows);
		}
	},

	async down(queryInterface) {
		await queryInterface.bulkDelete("settings", null, {});
	},
};
