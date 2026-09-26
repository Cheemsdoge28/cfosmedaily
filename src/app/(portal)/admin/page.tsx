import type { Metadata } from "next";
import Link from "next/link";

import { CreateClientForm } from "@/app/(portal)/admin/admin-forms";
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
import { formatDateTime } from "@/lib/finance/format";

export const metadata: Metadata = { title: "Clients" };

const STATUS_TONE = {
  CONNECTED: "good",
  DISCONNECTED: "neutral",
  ERROR: "bad",
} as const;

const STATUS_LABELS = {
  CONNECTED: "Connected",
  DISCONNECTED: "Not connected",
  ERROR: "Error",
} as const;

export default async function AdminPage() {
  await requirePlatformAdmin();

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      zohoConnection: true,
      _count: { select: { users: true, snapshots: true, businessUnits: true, fiscalYears: true } },
    },
  });

  return (
    <div className="mx-auto w-full max-w-[96rem]">
      <PageHeading
        title="Clients"
        description="Every company on the portal, and who can sign in to each. Anything you change here is recorded in the audit log."
      />
      <Stack>
        <Card title="Clients">
          {clients.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No clients yet. Add the first one below.
            </p>
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <Tr>
                    <Th grow>Client</Th>
                    <Th align="right">Logins</Th>
                    <Th align="right">Months of figures</Th>
                    <Th>Zoho</Th>
                    <Th>Last import</Th>
                    <Th>Status</Th>
                  </Tr>
                </THead>
                <TBody>
                  {clients.map((client) => {
                    const status = client.zohoConnection?.status ?? "DISCONNECTED";
                    const incomplete =
                      client._count.fiscalYears === 0 ||
                      client._count.businessUnits === 0 ||
                      client._count.users === 0;

                    return (
                      <Tr key={client.id}>
                        <Td>
                          <Link
                            href={`/admin/clients/${client.id}`}
                            className="font-semibold text-heading underline-offset-2 hover:underline"
                          >
                            {client.name}
                          </Link>
                          <br />
                          <span className="text-muted-foreground">
                            {client.slug} &middot; {client.currency}
                          </span>
                        </Td>
                        <Td align="right">{client._count.users}</Td>
                        <Td align="right">{client._count.snapshots}</Td>
                        <Td>
                          <Badge tone={STATUS_TONE[status]}>
                            {STATUS_LABELS[status]}
                          </Badge>
                        </Td>
                        <Td className="text-muted-foreground">
                          {formatDateTime(client.zohoConnection?.lastSyncedAt ?? null)}
                        </Td>
                        <Td>
                          {!client.isActive ? (
                            <Badge tone="bad">Suspended</Badge>
                          ) : incomplete ? (
                            <Badge tone="warn">Setup incomplete</Badge>
                          ) : client._count.snapshots === 0 ? (
                            <Badge tone="warn">No figures</Badge>
                          ) : (
                            <Badge tone="good">Live</Badge>
                          )}
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
          <p className="mb-4 text-xs text-muted-foreground">
            Sets the client up with its business units and financial years,
            and their first login if you want one now. You are then taken to
            their page to connect Zoho Books and bring in the figures.
          </p>
          <CreateClientForm />
        </Card>
      </Stack>
    </div>
  );
}
