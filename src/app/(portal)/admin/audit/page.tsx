import type { Metadata } from "next";

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
import { auditActionLabel } from "@/lib/admin/labels";
import { requirePlatformAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/finance/format";

export const metadata: Metadata = { title: "Audit log" };

/** Actions that should stand out when scanning the log. */
const SECURITY_EVENTS = new Set([
  "auth.login.failure",
  "auth.login.locked",
  "user.password.reset",
  "user.deactivate",
  "zoho.sync.failure",
]);

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePlatformAdmin();

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const pageSize = 50;

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { email: true } },
        client: { select: { name: true } },
      },
    }),
    prisma.auditLog.count(),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto w-full max-w-[96rem]">
      <PageHeading
        title="Audit log"
        description="Every sign-in, password change and figure import, newest first."
        meta={`${total.toLocaleString()} entries recorded`}
      />
      <Stack>
        <Card>
          <TableWrap>
            <Table>
              <THead>
                <Tr>
                  <Th grow>When</Th>
                  <Th>Action</Th>
                  <Th>Who</Th>
                  <Th>Client</Th>
                  <Th>From</Th>
                  <Th>Detail</Th>
                </Tr>
              </THead>
              <TBody>
                {entries.length === 0 ? (
                  <Tr>
                    <Td className="text-muted-foreground">Nothing recorded yet.</Td>
                    <Td />
                    <Td />
                    <Td />
                    <Td />
                    <Td />
                  </Tr>
                ) : (
                  entries.map((entry) => (
                    <Tr key={entry.id}>
                      <Td className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </Td>
                      <Td>
                        <Badge
                          tone={SECURITY_EVENTS.has(entry.action) ? "warn" : "neutral"}
                          // The key is kept on the element so the raw value is
                          // still there for anyone who needs to match on it.
                          title={entry.action}
                        >
                          {auditActionLabel(entry.action)}
                        </Badge>
                      </Td>
                      <Td className="text-muted-foreground">{entry.user?.email ?? "—"}</Td>
                      <Td className="text-muted-foreground">{entry.client?.name ?? "—"}</Td>
                      <Td className="text-muted-foreground">{entry.ipAddress ?? "—"}</Td>
                      <Td className="max-w-[20rem] truncate text-muted-foreground">
                        {entry.detail ?? "—"}
                      </Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </Table>
          </TableWrap>

          {pageCount > 1 && (
            <nav className="mt-4 flex items-center justify-between text-sm">
              <a
                href={`/admin/audit?page=${Math.max(1, page - 1)}`}
                aria-disabled={page === 1}
                className="rounded-md border border-border px-3 py-2 font-semibold text-heading aria-disabled:pointer-events-none aria-disabled:opacity-40"
              >
                Previous
              </a>
              <span className="text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <a
                href={`/admin/audit?page=${Math.min(pageCount, page + 1)}`}
                aria-disabled={page === pageCount}
                className="rounded-md border border-border px-3 py-2 font-semibold text-heading aria-disabled:pointer-events-none aria-disabled:opacity-40"
              >
                Next
              </a>
            </nav>
          )}
        </Card>
      </Stack>
    </div>
  );
}
