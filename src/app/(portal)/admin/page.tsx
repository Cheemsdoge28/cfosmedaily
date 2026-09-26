import type { Metadata } from "next";

import {
  ClientActiveToggle,
  CreateClientForm,
  CreateUserForm,
  UserRowActions,
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
import { roleLabel } from "@/lib/admin/labels";
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
        _count: { select: { users: true, tasks: true } },
        tasks: { select: { status: true, progress: true } },
      },
    }),
    prisma.user.findMany({
      orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
      include: { client: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-[96rem]">
      <PageHeading
        title="Clients & logins"
        description="Every company on the portal, and who can sign in to each. Anything you change here is recorded in the audit log."
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
                    <Th align="right">Logins</Th>
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
                          <span className="font-semibold text-heading">{client.name}</span>
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
                        <Td align="right">{client._count.users}</Td>
                        <Td>
                          {!client.isActive ? (
                            <Badge tone="bad">Suspended</Badge>
                          ) : client._count.tasks === 0 ? (
                            <Badge tone="warn">No tasks yet</Badge>
                          ) : client._count.users === 0 ? (
                            <Badge tone="neutral">No logins</Badge>
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
          description="CFOSME staff read every client. A client's own people see only their register."
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
                    <Th>Client</Th>
                    <Th>Access</Th>
                    <Th>Last signed in</Th>
                    <Th>Status</Th>
                    <Th />
                  </Tr>
                </THead>
                <TBody>
                  {users.map((user) => (
                    <Tr key={user.id}>
                      <Td>
                        <span className="font-semibold text-heading">{user.name}</span>
                        {user.id === admin.id && (
                          <span className="ms-2 text-xs text-muted-foreground">(you)</span>
                        )}
                        <br />
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </Td>
                      <Td className="text-muted-foreground">
                        {user.client?.name ?? "CFOSME"}
                      </Td>
                      <Td className="text-muted-foreground">{roleLabel(user.role)}</Td>
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
                        ) : (
                          <Badge tone="good">Active</Badge>
                        )}
                      </Td>
                      <Td>
                        {user.role === "PLATFORM_ADMIN" ? (
                          <span className="text-xs text-muted-foreground">
                            Managed outside this screen
                          </span>
                        ) : (
                          <UserRowActions
                            userId={user.id}
                            role={user.role}
                            isActive={user.isActive}
                            isSelf={user.id === admin.id}
                          />
                        )}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </Card>

        <Card title="Add a login">
          <CreateUserForm
            clients={clients.map((client) => ({ id: client.id, name: client.name }))}
          />
        </Card>

        <Card title="Add a client">
          <CreateClientForm />
        </Card>
      </Stack>
    </div>
  );
}
