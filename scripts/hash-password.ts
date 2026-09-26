/**
 * Hashes a password for manual database work.
 *
 *   npm run hash -- "the password"
 *
 * Normal password changes go through the admin screens, which hash, audit and
 * revoke sessions for you. This exists for recovery situations only.
 */

import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error('Usage: npm run hash -- "the password"');
  process.exit(1);
}

if (password.length < 12) {
  console.error("Refusing to hash a password shorter than 12 characters.");
  process.exit(1);
}

bcrypt.hash(password, 12).then((hash) => {
  console.log(hash);
});
