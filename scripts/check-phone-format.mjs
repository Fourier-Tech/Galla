import assert from "node:assert";

function formatPhoneNumber(phone) {
  if (!phone) return "";
  const cleaned = String(phone).trim();
  if (!cleaned) return "";

  const digits = cleaned.replace(/\D/g, "");
  if (!digits) return cleaned;

  let standardDigits = digits;
  if (standardDigits.length === 12 && standardDigits.startsWith("91")) {
    standardDigits = standardDigits.slice(2);
  } else if (standardDigits.length === 11 && standardDigits.startsWith("0")) {
    standardDigits = standardDigits.slice(1);
  } else if (standardDigits.length > 10) {
    standardDigits = standardDigits.slice(-10);
  }

  if (standardDigits.length === 10) {
    return `+91 ${standardDigits.slice(0, 5)} ${standardDigits.slice(5)}`;
  }

  if (digits.length <= 5) {
    return `+91 ${digits}`;
  }
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

// Runnable test cases
assert.strictEqual(formatPhoneNumber("9825012345"), "+91 98250 12345");
assert.strictEqual(formatPhoneNumber("+91 98250 12345"), "+91 98250 12345");
assert.strictEqual(formatPhoneNumber("+919825012345"), "+91 98250 12345");
assert.strictEqual(formatPhoneNumber("09825012345"), "+91 98250 12345");
assert.strictEqual(formatPhoneNumber("98250 12345"), "+91 98250 12345");
assert.strictEqual(formatPhoneNumber("98250-12345"), "+91 98250 12345");
assert.strictEqual(formatPhoneNumber("+91 00000 00000"), "+91 00000 00000");
assert.strictEqual(formatPhoneNumber("0000000000"), "+91 00000 00000");
assert.strictEqual(formatPhoneNumber(""), "");
assert.strictEqual(formatPhoneNumber(null), "");
assert.strictEqual(formatPhoneNumber(undefined), "");

console.log("All phone formatting tests passed successfully!");
