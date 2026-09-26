import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AccessEditor,
  type AccessRow,
} from "@/app/(portal)/admin/users/[id]/access-editor";
import {
  AccountForms,
  RoleForm,
  SessionForms,
} from "@/app/(portal)/admin/users/[id]/access-forms";
import {
  Badge,
  Callout,
  Card,
  Detail,
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
import { ButtonLink } from "@/components/ui/button";
import { auditActionLabel, roleLabel } from "@/lib/admin/labels";
import { requirePlatformAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/tasks/format";

export const metadata: Metadata = { title: "Account" };

/**
 * One account: what it can see, what it can change, and where it is signed in.
 *
 * Four cards, not eight. The earlier version gave every operation its own card,
 * which pushed the sessions list below two screenfuls of forms and made the page
 * read as a list of things you could do rather than a description of an account.
 * Now the shape follows the questions: what can they reach, who are they, where
 * are they signed in, what have they done.
 */
export default async function UserAccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requirePlatformAdmin();
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      access: {
        include: {
          client: { select: { id: true, name: true, isActive: true } },
          grantedBy: { select: { name: true } },
        },
        orderBy: { client: { name: "asc" } },
      },
      sessions: {
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { lastSeenAt: "desc" },
      },
    },
  });

  if (!user) notFound();

  const isPlatformAdmin = user.role === "PLATFORM_ADMIN";
  const isSelf = user.id === admin.id;

  // Every client the editor should offer: all the active ones, plus any the
  // account already holds even if that client has since been suspended — so a
  // dormant grant is visible and removable rather than invisible and stuck.
  const held = new Map(user.access.map((grant) => [grant.clientId, grant]));
  const clients = await prisma.client.findMany({
    where: { OR: [{ isActive: true }, { id: { in: [...held.keys()] } }] },
    select: { id: true, name: true, isActive: true },
    orderBy: { name: "asc" },
  });

  const accessRows: AccessRow[] = clients.map((client) => {
    const grant = held.get(client.id);
    return {
      clientId: client.id,
      clientName: client.name,
      level: grant ? grant.level : "NONE",
      clientIsActive: client.isActive,
      grantedByName: grant?.grantedBy?.name ?? null,
      grantedAt: grant?.createdAt.toISOString() ?? null,
    };
  });

  // The audit log is global and long; this is the slice belonging to them.
  const activity = await prisma.auditLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { client: { select: { name: true } } },
  });

  const editable = user.access.filter((grant) => grant.level === "EDIT").length;
  const isLocked = Boolean(user.lockedUntil && user.lockedUntil > new Date());

  return (
    <div className="mx-auto w-full max-w-[96rem]">
      <PageHeading
        title={user.name}
        description={user.email}
        meta={
          isPlatformAdmin
            ? "CFOSME staff · reads every client"
            : `${user.access.length} client${user.access.length === 1 ? "" : "s"} · ${editable} editable`
        }
        action={
          <ButtonLink variant="outline" size="lg" render={<Link href="/admin/users" />}>
            All users
          </ButtonLink>
        }
      />

      <Stack>
        {!user.isActive && (
          <Callout tone="bad" title="This account is deactivated">
            They cannot sign in, and their access below is dormant until the
            account is reactivated.
          </Callout>
        )}

        {isLocked && user.isActive && (
          <Callout tone="warn" title="Locked after repeated failed sign-ins">
            Locked until {formatDateTime(user.lockedUntil)}. Resetting the
            password clears it immediately.
          </Callout>
        )}

        {!isPlatformAdmin && user.access.length === 0 && user.isActive && (
          <Callout tone="warn" title="No clients granted">
            This account can sign in but has nothing to look at. Grant it a client
            below.
          </Callout>
        )}

        {/* ── What they can reach ─────────────────────────────────────────── */}
        {isPlatformAdmin ? (
          <Card title="Client access">
            <p className="text-sm text-muted-foreground">
              CFOSME staff read every client through their role, so there is
              nothing to grant. A client onboarded tomorrow is visible to them
              immediately — which is the reason the role does not work by granting
              each client one at a time.
            </p>
          </Card>
        ) : (
          <Card
            title="Client access"
            description="Set as many clients as you like, then save once. Nothing is written until you do."
            flush
          >
            <AccessEditor userId={user.id} rows={accessRows} />
          </Card>
        )}

        {/* ── Who they are ────────────────────────────────────────────────── */}
        <Card title="Account">
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Role" value={roleLabel(user.role)} />
            <Detail
              label="Status"
              value={
                !user.isActive ? (
                  <Badge tone="bad">Deactivated</Badge>
                ) : isLocked ? (
                  <Badge tone="warn">Locked</Badge>
                ) : user.mustChangePassword ? (
                  <Badge tone="warn">Must change password</Badge>
                ) : (
                  <Badge tone="good">Active</Badge>
                )
              }
            />
            <Detail label="Last signed in" value={formatDateTime(user.lastLoginAt)} />
            <Detail label="Added" value={formatDateTime(user.createdAt)} />
          </dl>

          <div className="mt-5 grid gap-5 border-t border-border pt-5 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Password and access
              </h3>
              <AccountForms
                userId={user.id}
                isActive={user.isActive}
                isSelf={isSelf}
              />
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Role
              </h3>
              {isSelf ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  This is your own account. Its role cannot be changed here, so an
                  administrator cannot lock themselves out of this screen.
                </p>
              ) : (
                <RoleForm userId={user.id} role={user.role} />
              )}
            </div>
          </div>
        </Card>

        {/* ── Where they are signed in ────────────────────────────────────── */}
        <Card
          title="Active sessions"
          description={
            user.sessions.length === 0
              ? "Not signed in anywhere"
              : `Signed in on ${user.sessions.length} device${user.sessions.length === 1 ? "" : "s"}`
          }
          action={
            user.sessions.length > 0 ? <SessionForms userId={user.id} /> : undefined
          }
          flush={user.sessions.length > 0}
        >
          {user.sessions.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              This account has no live sessions.
            </p>
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <Tr>
                    <Th>Last active</Th>
                    <Th>Signed in</Th>
                    <Th>IP address</Th>
                    <Th grow>Device</Th>
                    <Th />
                  </Tr>
                </THead>
                <TBody>
                  {user.sessions.map((session) => (
                    <Tr key={session.id}>
                      <Td className="whitespace-nowrap">
                        {formatDateTime(session.lastSeenAt)}
                      </Td>
                      <Td className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(session.createdAt)}
                      </Td>
                      <Td className="text-muted-foreground">
                        {session.ipAddress ?? "—"}
                      </Td>
                      <Td muted className="max-w-[22rem] truncate">
                        {session.userAgent ?? "—"}
                      </Td>
                      <Td align="right">
                        <SessionForms userId={user.id} sessionId={session.id} />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </Card>

        {/* ── What they have done ─────────────────────────────────────────── */}
        <Card
          title="Recent activity"
          description="This account's own entries from the audit log"
          flush={activity.length > 0}
        >
          {activity.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Nothing recorded for this account yet.
            </p>
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <Tr>
                    <Th>When</Th>
                    <Th>Action</Th>
                    <Th>Client</Th>
                    <Th grow>Detail</Th>
                  </Tr>
                </THead>
                <TBody>
                  {activity.map((entry) => (
                    <Tr key={entry.id}>
                      <Td className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </Td>
                      <Td>
                        <Badge tone="neutral" title={entry.action}>
                          {auditActionLabel(entry.action)}
                        </Badge>
                      </Td>
                      <Td className="text-muted-foreground">
                        {entry.client?.name ?? "—"}
                      </Td>
                      <Td muted className="max-w-[26rem] truncate">
                        {entry.detail ?? "—"}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </Stack>
    </div>
  );
}
