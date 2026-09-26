import type { Metadata } from "next";

import { CreateUserForm } from "@/app/(portal)/admin/admin-forms";
import {
  UserDirectory,
  type DirectoryUser,
} from "@/app/(portal)/admin/users/user-directory";
import { Card, PageHeading, Stack } from "@/components/ui/primitives";
import { requirePlatformAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Users" };

/**
 * Everyone who can sign in.
 *
 * Its own screen now. It used to be the second of four cards under Clients,
 * which meant the answer to "who can see this client" was two scrolls below a
 * table about something else.
 */
export default async function UsersPage() {
  const admin = await requirePlatformAdmin();

  const [users, clients] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: {
        access: {
          select: {
            clientId: true,
            level: true,
            client: { select: { name: true } },
          },
          orderBy: { client: { name: "asc" } },
        },
      },
    }),
    prisma.client.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const now = new Date();

  // Serialised here rather than passed as Prisma rows: the directory is a client
  // component, so it gets plain data and the dates as ISO strings.
  const directory: DirectoryUser[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    isLocked: Boolean(user.lockedUntil && user.lockedUntil > now),
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    isSelf: user.id === admin.id,
    grants: user.access.map((grant) => ({
      clientId: grant.clientId,
      clientName: grant.client.name,
      level: grant.level,
    })),
  }));

  const members = directory.filter((user) => user.role !== "PLATFORM_ADMIN");
  const withoutAccess = members.filter((user) => user.grants.length === 0).length;

  return (
    <div className="mx-auto w-full max-w-[96rem]">
      <PageHeading
        title="Users"
        description="Everyone who can sign in. Access is granted per client — open an account to manage what it can see."
        meta={[
          `${directory.length} account${directory.length === 1 ? "" : "s"}`,
          `${directory.length - members.length} CFOSME staff`,
          withoutAccess > 0
            ? `${withoutAccess} with no access granted`
            : "all members have access",
        ].join(" · ")}
      />

      <Stack>
        <UserDirectory users={directory} />

        <Card
          title="Add a login"
          description="Give them a first client now, or none — further clients are granted on the account's own page."
        >
          <CreateUserForm clients={clients} />
        </Card>
      </Stack>
    </div>
  );
}
