"use strict";

const Responses = {
	SUCCESS: {
		code: 200,
		message: "Success",
	},

	INTERNAL_SERVER_ERROR: {
		code: 500,
		message: "Internal server Error",
	},
	BAD_REQUEST: {
		code: 400,
		message: "Bad Request",
	},
	USER_NOT_FOUND: {
		code: 404,
		message: "User not found",
	},

	NOT_FOUND: {
		code: 404,
		message: "NOT found",
	},
};

module.exports = Responses;
