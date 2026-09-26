import type { Metadata } from "next";

import { ImportForm } from "@/app/(portal)/admin/import/import-form";
import {
  Badge,
  Callout,
  Card,
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
import { importResultLabel } from "@/lib/admin/labels";
import { requirePlatformAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { COLUMNS } from "@/lib/tasks/workbook";
import { formatDateTime } from "@/lib/tasks/format";

export const metadata: Metadata = { title: "Workbook import" };

/** The columns a row cannot be imported without. */
const REQUIRED_COLUMNS = new Set<string>(["Task ID", "Client", "Owner", "Frequency"]);

const RESULT_TONE = {
  SUCCESS: "good",
  PARTIAL: "warn",
  FAILED: "bad",
  RUNNING: "neutral",
} as const;

export default async function ImportPage() {
  await requirePlatformAdmin();

  const [imports, taskCount, clientCount] = await Promise.all([
    prisma.taskImport.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
      include: { user: { select: { name: true } } },
    }),
    prisma.task.count(),
    prisma.client.count(),
  ]);

  // The last import that reported problems, so the rows it could not read stay
  // on screen after the page is reloaded rather than only in the form's response.
  const lastWithErrors = imports.find((run) => run.errors.length > 0);

  return (
    <div className="mx-auto w-full max-w-[96rem]">
      <PageHeading
        title="Workbook import"
        description="Bring CFOSME_Task_Tracker.xlsx into the portal. Safe to run as often as the workbook changes."
        meta={`${taskCount} tasks across ${clientCount} clients`}
      />
      <Stack>
        <Card title="Import the workbook">
          <ImportForm />

          <Note>
            Tasks are matched on the workbook&rsquo;s own <b>Task ID</b>, so
            importing the same file twice updates rather than duplicates, and a task
            whose Client cell was corrected moves to that client instead of being
            copied. A client named in the workbook that the portal has not seen
            before is created. A row that cannot be read is reported below and the
            rest are still imported.
          </Note>
        </Card>

        {lastWithErrors && (
          <Callout
            tone={lastWithErrors.status === "FAILED" ? "bad" : "warn"}
            title={`Rows skipped in ${lastWithErrors.fileName}`}
          >
            <ul className="mt-1 list-disc space-y-0.5 ps-4">
              {lastWithErrors.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
            {lastWithErrors.skipped > lastWithErrors.errors.length && (
              <p className="mt-2">
                {lastWithErrors.skipped - lastWithErrors.errors.length} further
                problems were not listed.
              </p>
            )}
          </Callout>
        )}

        <Card
          title="Import history"
          description="The last twenty uploads, newest first"
        >
          {imports.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing imported yet.
            </p>
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <Tr>
                    <Th grow>When</Th>
                    <Th>File</Th>
                    <Th>Who</Th>
                    <Th align="right">Read</Th>
                    <Th align="right">Created</Th>
                    <Th align="right">Updated</Th>
                    <Th align="right">Unchanged</Th>
                    <Th align="right">Skipped</Th>
                    <Th>Result</Th>
                  </Tr>
                </THead>
                <TBody>
                  {imports.map((run) => (
                    <Tr key={run.id}>
                      <Td className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(run.startedAt)}
                      </Td>
                      <Td className="max-w-[16rem] truncate">{run.fileName}</Td>
                      <Td className="text-muted-foreground">{run.user?.name ?? "—"}</Td>
                      <Td align="right">{run.rowsRead}</Td>
                      <Td align="right">{run.created}</Td>
                      <Td align="right">{run.updated}</Td>
                      <Td align="right" muted>
                        {run.unchanged}
                      </Td>
                      <Td align="right">{run.skipped}</Td>
                      <Td>
                        <Badge tone={RESULT_TONE[run.status]}>
                          {importResultLabel(run.status)}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </Card>

        <Card
          title="What the sheet must contain"
          description="Column order does not matter; the names do"
        >
          <p className="mb-3 text-sm text-muted-foreground">
            The importer looks for a sheet called <b>Tasks</b> (or the first sheet)
            and finds the header row by locating <b>Task ID</b>. Of these,{" "}
            <b>Task ID</b>, <b>Client</b>, <b>Owner</b> and <b>Frequency</b> are
            required on every row; the rest may be blank.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {COLUMNS.map((column) => (
              <li key={column}>
                {/* The four required columns carry the weight; the optional ones
                    recede. Same tone throughout — this is a checklist, not a
                    status, and colour here would mean nothing. */}
                <Badge
                  className={
                    REQUIRED_COLUMNS.has(column) ? "font-semibold" : "opacity-75"
                  }
                >
                  {column}
                </Badge>
              </li>
            ))}
          </ul>
          <Note>
            Frequency must be one of Daily, Weekly, Fortnightly, Monthly, Quarterly,
            Half-yearly, Annual or Ad hoc. Status may be Done, In progress, At risk,
            Blocked or Not started — a blank Status is taken as Not started, but a
            word the register does not recognise is reported rather than guessed at,
            because guessing would hide the typo.
          </Note>
        </Card>
      </Stack>
    </div>
  );
}
