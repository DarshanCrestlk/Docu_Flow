"use strict";

/**
 * Builds a facade action that forwards to another service while preserving params and meta.
 * @param {string} targetService - e.g. "pdfFormSigning"
 * @param {string} targetAction - e.g. "fillFormFields"
 * @param {object} [options]
 * @param {object} [options.params] - fastest-validator schema
 * @param {boolean} [options.authorization]
 */
function delegateAction(targetService, targetAction, options = {}) {
	const action = {
		async handler(ctx) {
			return ctx.call(`${targetService}.${targetAction}`, ctx.params, {
				meta: ctx.meta,
				timeout: ctx.options?.timeout,
			});
		},
	};
	if (options.params) {
		action.params = options.params;
	}
	if (options.authorization === false) {
		action.authorization = false;
	}
	return action;
}

module.exports = { delegateAction };
