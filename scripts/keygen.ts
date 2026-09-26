/**
 * Generates the secrets the application needs.
 *
 *   npm run keygen
 *
 * APP_ENCRYPTION_KEY is a 32-byte AES-256-GCM key used to encrypt stored Zoho
 * tokens. CRON_SECRET authorises the scheduled sync endpoint.
 *
 * Rotating APP_ENCRYPTION_KEY makes existing encrypted Zoho tokens unreadable —
 * reconnect each client afterwards.
 */

import { randomBytes } from "node:crypto";

console.log(`APP_ENCRYPTION_KEY="${randomBytes(32).toString("base64")}"`);
console.log(`CRON_SECRET="${randomBytes(32).toString("base64url")}"`);
