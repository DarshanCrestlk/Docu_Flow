"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		const now = new Date();
		const existing = await queryInterface.sequelize.query(
			`SELECT id FROM companies WHERE name = 'myslice' LIMIT 1`,
			{ type: queryInterface.sequelize.QueryTypes.SELECT }
		);

		if (existing.length > 0) {
			return;
		}

		await queryInterface.bulkInsert("companies", [
			{
				name: "myslice",
				phone_no: "+10000000000",
				from_email_name: "MySlice",
				from_email: "noreply@myslice.local",
				industry: "Technology",
				address: "123 Dev Street",
				country: "United States",
				logo: null,
				theme: null,
				themejson: null,
				company_domain: "myslice.local",
				document_storage: null,
				createdAt: now,
				updatedAt: now,
			},
		]);
	},

	async down(queryInterface) {
		await queryInterface.bulkDelete("companies", { name: "myslice" });
	},
};
