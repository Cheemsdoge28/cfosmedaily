import type { Metadata } from "next";
import Link from "next/link";

import {
  ClientActiveToggle,
  CreateClientForm,
  CreateUserForm,
} from "@/app/(portal)/admin/admin-forms";
import {
  Badge,
  Card,
  PageHeading,
  Stack,
  TBody,
  THead,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from "@/components/ui/primitives";
import { accessLevelLabel, reachLabel, roleLabel } from "@/lib/admin/labels";
import { requirePlatformAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { formatDateTime, formatPercent } from "@/lib/tasks/format";

export const metadata: Metadata = { title: "Clients & logins" };

export default async function AdminPage() {
  const admin = await requirePlatformAdmin();

  const [clients, users] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { tasks: true, access: true } },
        tasks: { select: { status: true, progress: true } },
      },
    }),
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: {
        access: {
          select: { level: true, client: { select: { name: true } } },
          orderBy: { client: { name: "asc" } },
        },
      },
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-[96rem]">
      <PageHeading
        title="Clients & logins"
        description="Every company on the portal and everyone who can sign in. Access is granted per client, per person — open a login to manage it. Anything you change here is recorded in the audit log."
        meta={`${clients.length} clients · ${users.length} logins`}
      />
      <Stack>
        <Card
          title="Clients"
          description="Most clients arrive on their own, created by a workbook import the first time their name appears in it."
        >
          {clients.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No clients yet. Import the workbook, or add the first one below.
            </p>
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <Tr>
                    <Th grow>Client</Th>
                    <Th align="right">Tasks</Th>
                    <Th align="right">Completion</Th>
                    <Th align="right">People with access</Th>
                    <Th>Status</Th>
                    <Th />
                  </Tr>
                </THead>
                <TBody>
                  {clients.map((client) => {
                    // Derived here rather than stored, exactly as the dashboard
                    // does it, so the two cannot disagree.
                    const completion = client.tasks.length
                      ? Math.round(
                          client.tasks.reduce((sum, t) => sum + t.progress, 0) /
                            client.tasks.length,
                        )
                      : 0;

                    return (
                      <Tr key={client.id}>
                        <Td>
                          <span className="font-semibold text-heading">
                            {client.name}
                          </span>
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {client.slug}
                            {client.legalName ? ` · ${client.legalName}` : ""}
                          </span>
                        </Td>
                        <Td align="right">{client._count.tasks}</Td>
                        <Td align="right">
                          {client.tasks.length ? formatPercent(completion) : "—"}
                        </Td>
                        <Td align="right">
                          {/* Staff are not counted: they read every client by
                              role, so a number here would be the same on every
                              row and would say nothing about this one. */}
                          {client._count.access}
                        </Td>
                        <Td>
                          {!client.isActive ? (
                            <Badge tone="bad">Suspended</Badge>
                          ) : client._count.tasks === 0 ? (
                            <Badge tone="warn">No tasks yet</Badge>
                          ) : (
                            <Badge tone="good">Live</Badge>
                          )}
                        </Td>
                        <Td>
                          <ClientActiveToggle
                            clientId={client.id}
                            isActive={client.isActive}
                          />
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </Card>

        <Card
          title="Logins"
          description="CFOSME staff read every client. Everyone else sees exactly the clients granted to them."
        >
          {users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No logins yet.
            </p>
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <Tr>
                    <Th grow>Person</Th>
                    <Th>Role</Th>
                    <Th>Can see</Th>
                    <Th>Last signed in</Th>
                    <Th>Status</Th>
                    <Th />
                  </Tr>
                </THead>
                <TBody>
                  {users.map((user) => {
                    const editable = user.access.filter(
                      (grant) => grant.level === "EDIT",
                    ).length;

                    return (
                      <Tr key={user.id}>
                        <Td>
                          <Link
                            href={`/admin/users/${user.id}`}
                            className="font-semibold text-heading underline-offset-2 hover:underline"
                          >
                            {user.name}
                          </Link>
                          {user.id === admin.id && (
                            <span className="ms-2 text-xs text-muted-foreground">
                              (you)
                            </span>
                          )}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {user.email}
                          </span>
                        </Td>
                        <Td className="text-muted-foreground">
                          {roleLabel(user.role)}
                        </Td>
                        <Td>
                          <span className="text-foreground">
                            {reachLabel(user.role, user.access.length)}
                          </span>
                          {user.role !== "PLATFORM_ADMIN" &&
                            user.access.length > 0 && (
                              <>
                                <br />
                                <span
                                  className="text-xs text-muted-foreground"
                                  // The full list, for an account with more
                                  // clients than a cell can show.
                                  title={user.access
                                    .map(
                                      (grant) =>
                                        `${grant.client.name} — ${accessLevelLabel(grant.level)}`,
                                    )
                                    .join("\n")}
                                >
                                  {editable === 0
                                    ? "all view only"
                                    : editable === user.access.length
                                      ? "all editable"
                                      : `${editable} editable`}
                                </span>
                              </>
                            )}
                        </Td>
                        <Td className="whitespace-nowrap text-muted-foreground">
                          {formatDateTime(user.lastLoginAt)}
                        </Td>
                        <Td>
                          {!user.isActive ? (
                            <Badge tone="bad">Deactivated</Badge>
                          ) : user.lockedUntil && user.lockedUntil > new Date() ? (
                            <Badge tone="warn">Locked</Badge>
                          ) : user.mustChangePassword ? (
                            <Badge tone="warn">Must change password</Badge>
                          ) : user.role !== "PLATFORM_ADMIN" &&
                            user.access.length === 0 ? (
                            // Active, able to sign in, and there is nothing
                            // there — worth flagging rather than leaving to be
                            // discovered by the person it happened to.
                            <Badge tone="warn">No access granted</Badge>
                          ) : (
                            <Badge tone="good">Active</Badge>
                          )}
                        </Td>
                        <Td>
                          <Link
                            href={`/admin/users/${user.id}`}
                            className="text-sm font-medium text-heading underline-offset-2 hover:underline"
                          >
                            Manage access
                          </Link>
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </Card>

        <Card
          title="Add a login"
          description="One client to start with, or none — further clients are granted on the account's own page."
        >
          <CreateUserForm
            clients={clients
              .filter((client) => client.isActive)
              .map((client) => ({ id: client.id, name: client.name }))}
          />
        </Card>

        <Card title="Add a client">
          <CreateClientForm />
        </Card>
      </Stack>
    </div>
  );
}
