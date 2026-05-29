"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		const tables = await queryInterface.showAllTables();
		const tableSet = new Set(
			tables.map((t) => (typeof t === "string" ? t : t.tableName || t))
		);

		if (
			tableSet.has("sliceseal_email_types") &&
			!tableSet.has("pdf_form_email_types")
		) {
			await queryInterface.renameTable(
				"sliceseal_email_types",
				"pdf_form_email_types"
			);
		}

		if (
			tableSet.has("sliceseal_email_templates") &&
			!tableSet.has("pdf_form_email_templates")
		) {
			await queryInterface.renameTable(
				"sliceseal_email_templates",
				"pdf_form_email_templates"
			);
		}
	},

	async down(queryInterface) {
		const tables = await queryInterface.showAllTables();
		const tableSet = new Set(
			tables.map((t) => (typeof t === "string" ? t : t.tableName || t))
		);

		if (
			tableSet.has("pdf_form_email_types") &&
			!tableSet.has("sliceseal_email_types")
		) {
			await queryInterface.renameTable(
				"pdf_form_email_types",
				"sliceseal_email_types"
			);
		}

		if (
			tableSet.has("pdf_form_email_templates") &&
			!tableSet.has("sliceseal_email_templates")
		) {
			await queryInterface.renameTable(
				"pdf_form_email_templates",
				"sliceseal_email_templates"
			);
		}
	},
};
