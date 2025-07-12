const { isEmpty } = require("lodash");

// Helper function to flatten nested objects using a pipe as a delimiter.
function flattenParams(obj, parentKey = "") {
 const parts = [];
 // Sort keys to ensure consistent ordering.
 Object.keys(obj)
  .sort()
  .forEach((key) => {
   const value = obj[key];
   // Create a composite key for nested properties.
   const newKey = parentKey ? `${parentKey}|${key}` : key;
   if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
   ) {
    // Recursively flatten nested objects.
    parts.push(flattenParams(value, newKey));
   } else if (Array.isArray(value)) {
    // Join array values with a pipe.
    parts.push(`${newKey}=${value.join("|")}`);
   } else {
    parts.push(`${newKey}=${value}`);
   }
  });
 return parts.join("&");
}

function keygen(name, params, meta, keys) {
 // Start with the company id, ensuring multi-tenancy separation.
 // Default to "global" if no company_id is provided.
 const companyId = meta?.user?.company_id || "global";
 let key = `${companyId}`;

 // Extract service and method names from the name
 const [service, method] = name.split(".");
 key += `:${service}:${method}`;

 // If params are provided, sort the keys for consistency and append them.
 if (!isEmpty(params)) {
  const paramsString = flattenParams(params);
  key += `:params:${paramsString}`;
 }

 console.log("Generated cache key:", key);
 return key;
}

module.exports = {
 keygen,
};