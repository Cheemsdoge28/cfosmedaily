/**
 * The access boundary, checked against the real database.
 *
 * Reads every account's actual grants, builds the same `TaskScope` the request
 * path builds, and puts it through the same `taskScopeFilter` and
 * `canEditClient` the pages and the write actions use. So this is not a
 * re-implementation of the rules — it is the rules, run against real rows.
 *
 * What it asserts, per account:
 *   - the number of tasks the filter actually returns;
 *   - that no task outside the granted clients is reachable;
 *   - that a client asked for in the URL cannot widen the result;
 *   - which clients are editable, and that a VIEW grant is not.
 *
 *   npm run check:access
 */

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
// access.ts, not scope.ts: the rules are pure there, so this exercises the real
// predicates without dragging in the session lookup and, with it, React.
import {
  canEditClient,
  editableClientIds,
  taskScopeFilter,
  type TaskScope,
} from "../src/lib/tasks/access";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Not present — rely on the ambient environment.
  }
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.DATABASE_URL!,
  }),
});

let failures = 0;
function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
    failures += 1;
  }
}

async function main() {
  const users = await prisma.user.findMany({
    // Removed accounts cannot sign in, so their grants are inert and checking
    // them would report an access boundary nobody can reach.
    where: { deletedAt: null },
    include: {
      access: {
        where: { client: { isActive: true } },
        include: { client: { select: { id: true, name: true, slug: true } } },
        orderBy: { client: { name: "asc" } },
      },
    },
    orderBy: { email: "asc" },
  });

  const totalTasks = await prisma.task.count();
  const allClients = await prisma.client.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  console.log(`register: ${totalTasks} tasks across ${allClients.length} clients\n`);

  for (const user of users) {
    const isPlatformAdmin = user.role === "PLATFORM_ADMIN";

    // Exactly the shape requireTaskScope produces for this account.
    const scope: TaskScope = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isPlatformAdmin,
        grants: user.access.map((grant) => ({
          id: grant.client.id,
          name: grant.client.name,
          slug: grant.client.slug,
          level: grant.level,
        })),
        mustChangePassword: user.mustChangePassword,
      },
      isPractice: isPlatformAdmin,
      visibleClientIds: isPlatformAdmin
        ? null
        : user.access.map((grant) => grant.clientId),
      grants: user.access.map((grant) => ({
        id: grant.client.id,
        name: grant.client.name,
        slug: grant.client.slug,
        level: grant.level,
      })),
    };

    const granted = scope.grants.map((grant) => grant.name).join(", ") || "none";
    console.log(`${user.email}  [${user.role}]  grants: ${granted}`);

    // ── What they can see ────────────────────────────────────────────────
    const visible = await prisma.task.findMany({
      where: taskScopeFilter(scope),
      select: { clientId: true },
    });
    const visibleClients = new Set(visible.map((task) => task.clientId));

    if (isPlatformAdmin) {
      check("sees the whole register", visible.length === totalTasks,
        `saw ${visible.length} of ${totalTasks}`);
    } else {
      const allowed = new Set(scope.visibleClientIds!);
      const leaked = [...visibleClients].filter((id) => !allowed.has(id));
      check(
        `sees only granted clients (${visible.length} tasks)`,
        leaked.length === 0,
        leaked.length ? `leaked ${leaked.length} client(s)` : "",
      );
      check(
        "cannot see the whole register",
        allowed.size === allClients.length || visible.length < totalTasks,
        `saw ${visible.length} of ${totalTasks}`,
      );
    }

    // ── A hand-edited ?client= must never widen ──────────────────────────
    const forbidden = allClients.find(
      (client) => !scope.grants.some((grant) => grant.id === client.id),
    );
    if (forbidden && !isPlatformAdmin) {
      const widened = await prisma.task.findMany({
        where: taskScopeFilter(scope, forbidden.id),
        select: { clientId: true },
      });
      const escaped = widened.some((task) => !visibleClients.has(task.clientId));
      check(
        `?client=${forbidden.name} cannot widen the view`,
        !escaped,
        escaped ? "reached an ungranted client" : "",
      );
    }

    // ── What they can change ─────────────────────────────────────────────
    const editable = editableClientIds(scope);
    if (isPlatformAdmin) {
      check("may edit every client", editable === null);
    } else {
      for (const grant of scope.grants) {
        const allowed = canEditClient(scope, grant.id);
        check(
          `${grant.name}: ${grant.level} -> ${allowed ? "editable" : "read-only"}`,
          allowed === (grant.level === "EDIT"),
        );
      }
      if (forbidden) {
        check(
          `cannot edit ${forbidden.name} (not granted)`,
          !canEditClient(scope, forbidden.id),
        );
      }
    }

    console.log("");
  }

  console.log(
    failures === 0
      ? "every access check passes"
      : `${failures} access check(s) FAILED`,
  );
  if (failures) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("check failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
