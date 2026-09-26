import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AccountForms,
  BulkAccessForms,
  ChangeLevelForm,
  GrantAccessForm,
  RevokeAccessForm,
  RoleForm,
  SessionForms,
} from "@/app/(portal)/admin/users/[id]/access-forms";
import {
  Badge,
  Callout,
  Card,
  Detail,
  Note,
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
import { accessLevelLabel, auditActionLabel, roleLabel } from "@/lib/admin/labels";
import { requirePlatformAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/tasks/format";

export const metadata: Metadata = { title: "Account access" };

/**
 * One person: what they can see, what they can change, and where they are signed in.
 *
 * This page exists because access used to be a single column on the user row, so
 * there was nothing to manage and nowhere to manage it. Now that a person can hold
 * any number of clients at either level, the questions an operator actually asks —
 * *which* clients, at what level, who granted them, is this person still signed in
 * on that laptop — each need an answer in one place.
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

  // Only clients they do not already hold are offerable, and only active ones —
  // granting a suspended client would produce a grant that resolves to nothing.
  const grantedIds = new Set(user.access.map((grant) => grant.clientId));
  const availableClients = await prisma.client.findMany({
    where: { isActive: true, id: { notIn: [...grantedIds] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // What this person has actually been doing. The audit log is global and long, so
  // this is the slice of it that belongs to them.
  const activity = await prisma.auditLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: { client: { select: { name: true } } },
  });

  const editable = user.access.filter((grant) => grant.level === "EDIT").length;

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
          <ButtonLink
            variant="outline"
            size="lg"
            render={<Link href="/admin" />}
          >
            All logins
          </ButtonLink>
        }
      />

      <Stack>
        {!user.isActive && (
          <Callout tone="bad" title="This account is deactivated">
            They cannot sign in, and their grants below are dormant until the
            account is reactivated.
          </Callout>
        )}

        {user.mustChangePassword && user.isActive && (
          <Callout tone="warn" title="Must set a new password">
            They will be sent to the password screen at their next sign-in and
            cannot reach the register until they have set one.
          </Callout>
        )}

        <Card title="Account">
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Role" value={roleLabel(user.role)} />
            <Detail
              label="Status"
              value={
                user.isActive ? (
                  <Badge tone="good">Active</Badge>
                ) : (
                  <Badge tone="bad">Deactivated</Badge>
                )
              }
            />
            <Detail label="Last signed in" value={formatDateTime(user.lastLoginAt)} />
            <Detail label="Added" value={formatDateTime(user.createdAt)} />
          </dl>

          {user.lockedUntil && user.lockedUntil > new Date() && (
            <Note>
              Locked after repeated failed sign-ins until{" "}
              {formatDateTime(user.lockedUntil)}. Resetting the password clears it.
            </Note>
          )}
        </Card>

        {/* ── Access ──────────────────────────────────────────────────────── */}
        {isPlatformAdmin ? (
          <Card title="Client access">
            <p className="text-sm text-muted-foreground">
              CFOSME staff read every client through their role, so there are no
              per-client grants to manage. A client onboarded tomorrow is visible
              to them immediately — which is the reason the role does not work by
              granting each client one at a time.
            </p>
          </Card>
        ) : (
          <>
            <Card
              title="Client access"
              description="Which clients this person can see, and whether they can move tasks"
            >
              {user.access.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No clients granted yet, so this account signs in to an empty
                  dashboard. Grant the first one below.
                </p>
              ) : (
                <TableWrap>
                  <Table>
                    <THead>
                      <Tr>
                        <Th grow>Client</Th>
                        <Th>Level</Th>
                        <Th>Granted</Th>
                        <Th>By</Th>
                        <Th />
                        <Th />
                      </Tr>
                    </THead>
                    <TBody>
                      {user.access.map((grant) => (
                        <Tr key={grant.id}>
                          <Td>
                            <span className="font-medium text-heading">
                              {grant.client.name}
                            </span>
                            {!grant.client.isActive && (
                              <>
                                <br />
                                <span className="text-xs text-muted-foreground">
                                  client suspended — this grant is dormant
                                </span>
                              </>
                            )}
                          </Td>
                          <Td>
                            <Badge tone={grant.level === "EDIT" ? "good" : "neutral"}>
                              {accessLevelLabel(grant.level)}
                            </Badge>
                          </Td>
                          <Td className="whitespace-nowrap text-muted-foreground">
                            {formatDateTime(grant.createdAt)}
                          </Td>
                          <Td className="text-muted-foreground">
                            {grant.grantedBy?.name ?? "—"}
                          </Td>
                          <Td>
                            <ChangeLevelForm
                              userId={user.id}
                              clientId={grant.clientId}
                              level={grant.level}
                            />
                          </Td>
                          <Td>
                            <RevokeAccessForm
                              userId={user.id}
                              clientId={grant.clientId}
                            />
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                </TableWrap>
              )}
            </Card>

            <Card title="Grant a client">
              <GrantAccessForm userId={user.id} clients={availableClients} />
            </Card>

            <Card
              title="Everything at once"
              description="For someone who covers the whole book, or who should no longer be here"
            >
              <BulkAccessForms userId={user.id} />
            </Card>
          </>
        )}

        {/* ── Sessions ────────────────────────────────────────────────────── */}
        <Card
          title="Active sessions"
          description="Where this account is currently signed in"
          action={
            user.sessions.length > 0 ? <SessionForms userId={user.id} /> : undefined
          }
        >
          {user.sessions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Not signed in anywhere.
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
                      <Td>
                        <SessionForms userId={user.id} sessionId={session.id} />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </Card>

        {/* ── The account itself ──────────────────────────────────────────── */}
        <Card title="Password and account">
          <AccountForms
            userId={user.id}
            isActive={user.isActive}
            isSelf={isSelf}
          />
        </Card>

        <Card title="Role">
          {isSelf ? (
            <p className="text-sm text-muted-foreground">
              This is your own account. Its role cannot be changed here, so an
              administrator cannot lock themselves out of this screen.
            </p>
          ) : (
            <RoleForm userId={user.id} role={user.role} />
          )}
        </Card>

        {/* ── What they have done ─────────────────────────────────────────── */}
        <Card
          title="Recent activity"
          description="This account's own entries from the audit log"
        >
          {activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
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
