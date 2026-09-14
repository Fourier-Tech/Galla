import assert from "node:assert";

function getPhoneDigits(val) {
  if (!val) return "";
  const digits = String(val).replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function filterCustomerSuggestions(customers, query) {
  const trimmed = (query || "").trim().toLowerCase();
  if (!trimmed || !Array.isArray(customers)) return [];
  return customers
    .filter((c) => c && c.name && c.name.toLowerCase().includes(trimmed))
    .slice(0, 5)
    .map((c) => ({
      name: c.name,
      phone: c.phone || "",
    }));
}

function checkPhoneConflict(customers, enteredName, enteredPhone) {
  const digits = getPhoneDigits(enteredPhone);
  if (digits.length !== 10 || !Array.isArray(customers)) return null;

  const match = customers.find((c) => getPhoneDigits(c.phone) === digits);
  if (!match) return null;

  const currentName = (enteredName || "").trim().toLowerCase();
  const registeredName = (match.name || "").trim().toLowerCase();

  if (currentName !== registeredName) {
    return {
      isConflict: true,
      registeredName: match.name,
    };
  }

  return {
    isConflict: false,
    registeredName: match.name,
  };
}

// Mock dataset
const sampleCustomers = [
  { name: "Krish Butani", phone: "+91 98250 12345", visits: 3, lastVisit: "Yesterday" },
  { name: "Krishna Patel", phone: "+91 98250 54321", visits: 1, lastVisit: "Today" },
  { name: "Priya Shah", phone: "+91 98765 43210", visits: 5, lastVisit: "Sep 10" },
  { name: "Amit Sharma", phone: "+91 99999 88888", visits: 2, lastVisit: "Sep 08" },
];

// 1. Suggestions only appear when user types
assert.deepStrictEqual(filterCustomerSuggestions(sampleCustomers, ""), []);
assert.deepStrictEqual(filterCustomerSuggestions(sampleCustomers, "   "), []);

// 2. Partial search finds Krish Butani and Krishna Patel
const kriMatches = filterCustomerSuggestions(sampleCustomers, "Kri");
assert.strictEqual(kriMatches.length, 2);
assert.strictEqual(kriMatches[0].name, "Krish Butani");
assert.strictEqual(kriMatches[0].phone, "+91 98250 12345");
// Ensure no visits field is exposed in the filtered suggestion display
assert.strictEqual(kriMatches[0].visits, undefined);

// 3. Case insensitivity
const lowerMatches = filterCustomerSuggestions(sampleCustomers, "krish");
assert.strictEqual(lowerMatches.length, 2);

// 4. Non-matching name returns empty list
assert.deepStrictEqual(filterCustomerSuggestions(sampleCustomers, "Zack"), []);

// 5. Phone conflict check when number is already registered under another name
const conflict = checkPhoneConflict(sampleCustomers, "Rohit", "9825012345");
assert.strictEqual(conflict.isConflict, true);
assert.strictEqual(conflict.registeredName, "Krish Butani");

// 6. No conflict when the registered name matches
const matchSame = checkPhoneConflict(sampleCustomers, "Krish Butani", "+91 98250 12345");
assert.strictEqual(matchSame.isConflict, false);

// 7. No conflict when phone is new/unregistered
const noConflict = checkPhoneConflict(sampleCustomers, "Rohit", "9123456789");
assert.strictEqual(noConflict, null);

console.log("All customer suggestion and phone conflict tests passed successfully!");
