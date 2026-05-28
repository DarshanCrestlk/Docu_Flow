"use strict";

/**
 * PDF form lifecycle — void, delete, expiration extension (authenticated).
 */
const pdfFormsBaseMixin = require("../pdfForms/shared/pdfFormsBase.mixin.js");
const {
	voidFormParams,
	deleteFormParams,
	extendExpirationDateParams,
} = require("../pdfForms/pdfForms.params.js");
const {
	voidForm,
	deleteForm,
	extendExpirationDate,
} = require("../pdfForms/pdfForms.methods.js");

module.exports = {
	name: "pdfFormLifecycle",

	settings: {},

	mixins: [pdfFormsBaseMixin],

	dependencies: [],

	actions: {
		/** Void in-progress form; notify recipients. */
		voidForm: {
			params: voidFormParams,
			handler: voidForm,
		},

		/** Soft-delete form with reason. */
		deleteForm: {
			params: deleteFormParams,
			handler: deleteForm,
		},

		/** Extend expiration (authenticated admin/creator). */
		extendExpirationDate: {
			params: extendExpirationDateParams,
			handler: extendExpirationDate,
		},
	},

	events: {},
	created() {},
	async started() {},
	async stopped() {},
};
