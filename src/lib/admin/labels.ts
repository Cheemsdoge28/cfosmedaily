/**
 * Plain-English labels for values the database stores in its own shorthand.
 *
 * These were being printed raw: an operator read "PARTIAL", "import.success" and
 * "NOT_STARTED" — the identifiers a developer chose, shown to someone running an
 * accounting practice. The mapping lives in one place so two screens cannot
 * disagree, and anything unrecognised falls back to the raw value rather than
 * vanishing.
 */

const IMPORT_RESULTS: Record<string, string> = {
  SUCCESS: "Complete",
  PARTIAL: "Partly done",
  FAILED: "Failed",
  RUNNING: "Running",
};

export function importResultLabel(status: string): string {
  return IMPORT_RESULTS[status] ?? status;
}

const ROLES: Record<string, string> = {
  PLATFORM_ADMIN: "CFOSME staff",
  MEMBER: "Member",
};

export function roleLabel(role: string): string {
  return ROLES[role] ?? role;
}

const ACCESS_LEVELS: Record<string, string> = {
  VIEW: "View only",
  EDIT: "Can edit",
};

export function accessLevelLabel(level: string): string {
  return ACCESS_LEVELS[level] ?? level;
}

/**
 * What an account can reach, in one phrase.
 *
 * A platform admin's reach comes from their role and does not change as clients
 * are added, so it is stated rather than counted.
 */
export function reachLabel(role: string, grantCount: number): string {
  if (role === "PLATFORM_ADMIN") return "Every client";
  if (grantCount === 0) return "No clients yet";
  return `${grantCount} ${grantCount === 1 ? "client" : "clients"}`;
}

const CHANGE_SOURCES: Record<string, string> = {
  MANUAL: "Edited in the register",
  IMPORT: "From a workbook import",
};

export function changeSourceLabel(source: string): string {
  return CHANGE_SOURCES[source] ?? source;
}

/**
 * Audit actions, which are stored as dotted keys so they stay stable and
 * searchable. The log itself is read by people, not by a parser, so it shows the
 * sentence rather than the key.
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
  "user.remove": "Account removed",
  "user.restore": "Account restored",
  "user.password.reset": "Password reset",
  "access.grant": "Client access granted",
  "access.update": "Client access changed",
  "access.revoke": "Client access revoked",
  "task.update": "Task moved",
  "import.start": "Import started",
  "import.success": "Import finished",
  "import.failure": "Import failed",
  "export.download": "Workbook downloaded",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTIONS[action] ?? action;
}
