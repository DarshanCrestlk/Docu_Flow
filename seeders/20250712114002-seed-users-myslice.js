"use strict";

const bcrypt = require("bcrypt");

/** Dev login password for both seeded users: Password@123 */
const DEV_PASSWORD = "Password@123";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		const companies = await queryInterface.sequelize.query(
			`SELECT id FROM companies WHERE name = 'myslice' LIMIT 1`,
			{ type: queryInterface.sequelize.QueryTypes.SELECT }
		);

		if (companies.length === 0) {
			throw new Error(
				"Company 'myslice' not found. Run seeder 20250712114001-seed-company-myslice.js first."
			);
		}

		const companyId = companies[0].id;
		const now = new Date();
		const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

		const seedUsers = [
			{
				email: "admin@myslice.local",
				full_name: "MySlice Admin",
				type: "admin",
			},
			{
				email: "user@myslice.local",
				full_name: "MySlice User",
				type: "user",
			},
		];

		for (const user of seedUsers) {
			const existing = await queryInterface.sequelize.query(
				`SELECT id FROM users WHERE email = :email LIMIT 1`,
				{
					replacements: { email: user.email },
					type: queryInterface.sequelize.QueryTypes.SELECT,
				}
			);

			if (existing.length > 0) {
				continue;
			}

			await queryInterface.bulkInsert("users", [
				{
					company_id: companyId,
					full_name: user.full_name,
					password: passwordHash,
					email: user.email,
					mobile_number: null,
					profile_bg_color: null,
					type: user.type,
					profile_pic: null,
					timezone: "UTC",
					user_from: "DOCU_FLOW",
					status: "active",
					createdAt: now,
					updatedAt: now,
				},
			]);
		}
	},

	async down(queryInterface) {
		await queryInterface.bulkDelete("users", {
			email: "admin@myslice.local",
		});
		await queryInterface.bulkDelete("users", {
			email: "user@myslice.local",
		});
	},
};
