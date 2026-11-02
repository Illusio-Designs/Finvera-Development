/* Password rules — one place, one message format, used by change-password,
   reset / invite-accept and admin create/update.
   checkPassword(pw) → null when fine, else { message, field: "password" }. */

const RULES_TEXT = "Password must be at least 8 characters and include at least one letter and one number.";

// The 20 most common passwords (from breach lists) — refused outright.
const COMMON = new Set([
  "123456", "password", "123456789", "12345678", "12345", "qwerty", "1234567", "111111",
  "123123", "abc123", "password1", "1234567890", "qwerty123", "000000", "iloveyou",
  "1q2w3e4r", "admin123", "password123", "welcome1", "abcd1234",
]);

function checkPassword(pw) {
  const p = typeof pw === "string" ? pw : "";
  if (p.length < 8 || p.length > 128 || !/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return { message: RULES_TEXT, field: "password" };
  if (COMMON.has(p.toLowerCase())) return { message: `That password is too common. ${RULES_TEXT}`, field: "password" };
  return null;
}

module.exports = { checkPassword, RULES_TEXT };
