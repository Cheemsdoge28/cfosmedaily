import type { Metadata } from "next";

import { ChangePasswordForm } from "@/app/(portal)/account/change-password-form";
import {
  Badge,
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
import { requireUser } from "@/lib/auth/guard";
import { formatDateTime } from "@/lib/tasks/format";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();

  const sessions = await prisma.session.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    take: 10,
  });

  return (
    <div className="mx-auto w-full max-w-[96rem]">
      <PageHeading
        title="Account settings"
        description="Your sign-in details and active sessions."
      />
      <Stack>
        <Card title="Profile">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Name" value={user.name} />
            <Detail label="E-mail" value={user.email} />
            <Detail label="Role" value={ROLE_LABELS[user.role] ?? user.role} />
            <Detail
              label="Clients you can see"
              value={
                user.isPlatformAdmin
                  ? "Every client on the portal"
                  : user.grants.length === 0
                    ? "None yet — ask CFOSME to grant access"
                    : `${user.grants.length}`
              }
            />
          </dl>
        </Card>

        {!user.isPlatformAdmin && (
          <Card
            title="Your access"
            description="Granted by CFOSME. Ask them if something is missing."
          >
            {user.grants.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No clients have been granted to your account yet, so the dashboard
                and register are empty. CFOSME grants access per client.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {user.grants.map((grant) => (
                  <li
                    key={grant.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate text-foreground">
                      {grant.name}
                    </span>
                    <Badge tone={grant.level === "EDIT" ? "good" : "neutral"}>
                      {grant.level === "EDIT" ? "Can edit" : "View only"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card title="Change password">
          <ChangePasswordForm />
        </Card>

        <Card title="Active sessions">
          <TableWrap>
            <Table>
              <THead>
                <Tr>
                  <Th>Last active</Th>
                  <Th>IP address</Th>
                  <Th grow>Device</Th>
                </Tr>
              </THead>
              <TBody>
                {sessions.map((session) => (
                  <Tr key={session.id}>
                    <Td>{formatDateTime(session.lastSeenAt)}</Td>
                    <Td>{session.ipAddress ?? "—"}</Td>
                    <Td muted className="max-w-[24rem] truncate">
                      {session.userAgent ?? "—"}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
          <Note>
            Changing your password signs out every other device immediately.
          </Note>
        </Card>
      </Stack>
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  PLATFORM_ADMIN: "CFOSME staff — reads every client",
  MEMBER: "Member — sees the clients granted below",
};

