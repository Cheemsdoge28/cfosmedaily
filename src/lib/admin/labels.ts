/**
 * Plain-English labels for values the database and the Zoho API store in
 * their own shorthand.
 *
 * These were being printed raw: an operator read "cron", "SUCCESS" and
 * "profitandloss, balancesheet, aragingsummary" — the identifiers a developer
 * chose, shown to someone running an accounting practice. The mapping lives in
 * one place so the two screens that show a sync history cannot disagree, and
 * anything unrecognised falls back to the raw value rather than vanishing.
 */

const SYNC_TRIGGERS: Record<string, string> = {
  manual: "By hand",
  cron: "Scheduled",
};

const SYNC_RESULTS: Record<string, string> = {
  SUCCESS: "Complete",
  PARTIAL: "Partly done",
  FAILED: "Failed",
  RUNNING: "Running",
};

const ZOHO_REPORTS: Record<string, string> = {
  profitandloss: "Profit & Loss",
  balancesheet: "Balance Sheet",
  cashflow: "Cash Flow",
  aragingsummary: "Receivables ageing",
  apagingsummary: "Payables ageing",
};

export function syncTriggerLabel(trigger: string): string {
  return SYNC_TRIGGERS[trigger] ?? trigger;
}

export function syncResultLabel(status: string): string {
  return SYNC_RESULTS[status] ?? status;
}

/** "Profit & Loss, Balance Sheet, Cash Flow" — or a dash when none ran. */
export function reportsLabel(reports: string[]): string {
  if (reports.length === 0) return "—";
  return reports.map((report) => ZOHO_REPORTS[report] ?? report).join(", ");
}

/**
 * Audit actions, which are stored as dotted keys so they stay stable and
 * searchable. The log itself is read by people, not by a parser, so it shows
 * the sentence rather than the key.
 */
const AUDIT_ACTIONS: Record<string, string> = {
  "auth.login.success": "Signed in",
  "auth.login.failure": "Sign-in refused",
  "auth.login.locked": "Account locked",
  "auth.logout": "Signed out",
  "auth.password.change": "Password changed",
  "client.create": "Client added",
  "client.update": "Client updated",
  "user.create": "Login created",
  "user.update": "Login updated",
  "user.deactivate": "Login deactivated",
  "user.password.reset": "Password reset",
  "zoho.connect": "Zoho Books connected",
  "zoho.disconnect": "Zoho Books disconnected",
  "zoho.sync.start": "Import started",
  "zoho.sync.failure": "Import failed",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTIONS[action] ?? action;
}
