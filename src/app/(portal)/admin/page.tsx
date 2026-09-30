import type { Metadata } from "next";
import Link from "next/link";

import {
  ClientActiveToggle,
  CreateClientForm,
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
import { requirePlatformAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { formatPercent } from "@/lib/tasks/format";

export const metadata: Metadata = { title: "Clients" };

/**
 * The client list.
 *
 * Clients only. The logins that used to share this page have their own screen
 * now — they are a different thing, managed by different questions, and putting
 * both here meant neither had room.
 */
export default async function AdminPage() {
  await requirePlatformAdmin();

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          tasks: true,
          // Removed accounts keep their grants as part of the record, so the
          // count has to exclude them or a client reads as shared with someone
          // who can no longer sign in.
          access: { where: { user: { deletedAt: null } } },
        },
      },
      tasks: { select: { status: true, progress: true } },
    },
  });

  const totalTasks = clients.reduce(
    (sum, client) => sum + client._count.tasks,
    0,
  );

  return (
    <div className="mx-auto w-full max-w-[96rem]">
      <PageHeading
        title="Clients"
        description="Every company on the portal. Most arrive on their own, created by a workbook import the first time their name appears in it."
        meta={`${clients.length} clients · ${totalTasks} tasks`}
      />
      <Stack>
        <Card title="Clients">
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
                              role, so the number would be the same on every row
                              and would say nothing about this one. */}
                          {client._count.access === 0 ? (
                            <Link
                              href="/admin/users"
                              className="text-muted-foreground underline-offset-2 hover:underline"
                            >
                              none
                            </Link>
                          ) : (
                            client._count.access
                          )}
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

        <Card title="Add a client">
          <CreateClientForm />
        </Card>
      </Stack>
    </div>
  );
}
