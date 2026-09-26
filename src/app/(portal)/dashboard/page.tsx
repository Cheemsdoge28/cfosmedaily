import type { Metadata } from "next";

import { TrendChart } from "@/components/charts/trend-chart";
import { ExpenseDonut } from "@/components/charts/expense-donut";
import { KpiRow } from "@/components/dashboard/kpi-card";
import {
  ModuleFrame,
  NoDataNotice,
} from "@/components/dashboard/module-frame";
import {
  Badge,
  Card,
  Row,
  TBody,
  THead,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from "@/components/ui/primitives";
import { percentChange } from "@/lib/finance/derive";
import {
  formatMoney,
  formatPercent,
  formatSignedPercent,
} from "@/lib/finance/format";
import {
  loadModuleContext,
  type ModuleSearchParams,
} from "@/lib/finance/module-data";
import { loadExpenseMix } from "@/lib/finance/queries";

export const metadata: Metadata = { title: "Executive Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: ModuleSearchParams;
}) {
  const context = await loadModuleContext(searchParams);
  if (!context.ready) return <NoDataNotice />;

  const { dataset, clientId } = context;
  const { current, previous, previousLabel, filters, series } = dataset;
  const currency = filters.currency;

  const expenseMix = await loadExpenseMix(clientId, filters);

  const revenueChange = previous ? percentChange(current.revenue, previous.revenue) : null;
  const cashChange = previous ? current.cashAndBank - previous.cashAndBank : null;

  return (
    <ModuleFrame
      title="Executive Dashboard"
      description="Management overview of profitability, liquidity and working capital"
      filters={filters}
    >
      <KpiRow
        items={[
          {
            label: "Revenue",
            value: formatMoney(current.revenue, currency),
            caption:
              revenueChange !== null
                ? `${formatSignedPercent(revenueChange)} vs ${previousLabel}`
                : "No comparative period",
            captionTone:
              revenueChange === null
                ? "neutral"
                : revenueChange >= 0
                  ? "positive"
                  : "negative",
            icon: "chart",
            variant: 0,
          },
          {
            label: "Gross Profit",
            value: formatMoney(current.grossProfit, currency),
            caption: `${formatPercent(current.grossMarginPct)} margin`,
            captionTone: "positive",
            icon: "coins",
            variant: 1,
          },
          {
            label: "Operating Expenses",
            value: formatMoney(current.opex, currency),
            caption: `${formatPercent(current.opexRatioPct)} of revenue`,
            icon: "gear",
            variant: 2,
          },
          {
            label: "EBITDA",
            value: formatMoney(current.ebitda, currency),
            caption: `${formatPercent(current.ebitdaMarginPct)} margin`,
            captionTone: "positive",
            icon: "trendUp",
            variant: 3,
          },
          {
            label: "Net Profit",
            value: formatMoney(current.netProfit, currency),
            caption: `${formatPercent(current.netMarginPct)} margin`,
            captionTone: current.netProfit >= 0 ? "positive" : "negative",
            icon: "target",
            variant: 4,
          },
          {
            label: "Cash & Bank",
            value: formatMoney(current.cashAndBank, currency),
            caption:
              cashChange !== null
                ? `${cashChange >= 0 ? "▲" : "▼"} ${formatMoney(Math.abs(cashChange), currency)} in period`
                : "Closing position",
            captionTone:
              cashChange === null ? "neutral" : cashChange >= 0 ? "positive" : "negative",
            icon: "bank",
            variant: 5,
          },
        ]}
      />

      {/* The profitability bridge, stated as the arithmetic it actually is. */}
      <Card title="Profitability bridge · selected period">
        <TableWrap>
          <Table>
            <TBody>
              <BridgeRow label="Revenue" value={current.revenue} currency={currency} />
              <BridgeRow label="less Cost of goods sold" value={-current.cogs} currency={currency} />
              <BridgeRow label="Gross profit" value={current.grossProfit} currency={currency} subtotal />
              {current.otherIncome !== 0 && (
                <BridgeRow label="add Other income" value={current.otherIncome} currency={currency} />
              )}
              <BridgeRow label="less Operating expenses" value={-current.opex} currency={currency} />
              <BridgeRow label="EBITDA" value={current.ebitda} currency={currency} subtotal />
              <BridgeRow label="less Depreciation" value={-current.depreciation} currency={currency} />
              <BridgeRow label="less Finance cost" value={-current.financeCost} currency={currency} />
              <BridgeRow label="less Tax" value={-current.taxExpense} currency={currency} />
              <BridgeRow label="Net profit" value={current.netProfit} currency={currency} subtotal />
            </TBody>
          </Table>
        </TableWrap>
      </Card>

      <Row className="xl:grid-cols-[1.4fr_1fr]">
        <Card title="Revenue & EBITDA trend">
          <TrendChart
            currency={currency}
            data={series.map((point) => ({
              label: point.label,
              revenue: point.metrics.revenue,
              ebitda: point.metrics.ebitda,
            }))}
          />
        </Card>

        <Card title="Expense mix">
          <ExpenseDonut currency={currency} data={expenseMix} />
        </Card>
      </Row>

      <Row className="xl:grid-cols-2">
        <Card title="Working capital snapshot">
          <TableWrap>
            <Table>
              <THead>
                <Tr>
                  <Th grow>Metric</Th>
                  <Th align="right">Closing</Th>
                  <Th align="right">Movement</Th>
                  <Th>Status</Th>
                </Tr>
              </THead>
              <TBody>
                <WorkingCapitalRow
                  label="Receivables"
                  current={current.receivables}
                  previous={previous?.receivables}
                  currency={currency}
                  higherIsWorse
                />
                <WorkingCapitalRow
                  label="Inventory"
                  current={current.inventory}
                  previous={previous?.inventory}
                  currency={currency}
                  higherIsWorse
                />
                <WorkingCapitalRow
                  label="Payables"
                  current={current.payables}
                  previous={previous?.payables}
                  currency={currency}
                />
                <WorkingCapitalRow
                  label="Net working capital"
                  current={current.workingCapital}
                  previous={
                    previous
                      ? previous.receivables + previous.inventory - previous.payables
                      : undefined
                  }
                  currency={currency}
                  higherIsWorse
                  strong
                />
              </TBody>
            </Table>
          </TableWrap>
        </Card>

        <Card title="Management attention">
          <ul className="space-y-3">
            <Alert
              heading="Gross margin"
              detail={`${formatPercent(current.grossMarginPct)} for the selected period`}
              tone={current.grossMarginPct >= 35 ? "good" : "warn"}
              status={current.grossMarginPct >= 35 ? "Healthy" : "Review"}
            />
            <Alert
              heading="Operating expenses"
              detail={`${formatMoney(current.opex, currency)} — ${formatPercent(current.opexRatioPct)} of revenue`}
              tone={current.opexRatioPct <= 20 ? "good" : "warn"}
              status={current.opexRatioPct <= 20 ? "Within range" : "Watch"}
            />
            <Alert
              heading="Operating cash flow"
              detail={`${formatMoney(dataset.cashFlow.operatingCashFlow, currency)} generated`}
              tone={dataset.cashFlow.operatingCashFlow >= 0 ? "good" : "bad"}
              status={dataset.cashFlow.operatingCashFlow >= 0 ? "Positive" : "Negative"}
            />
            <Alert
              heading="Cash runway cover"
              // With nothing owed the ratio is undefined, and "∞x of current
              // payables" reads as a rendering fault rather than a good month.
              detail={
                current.payables
                  ? `Cash covers ${(
                      current.cashAndBank / current.payables
                    ).toFixed(2)}x of current payables`
                  : "No payables outstanding at the period end"
              }
              tone={
                !current.payables || current.cashAndBank / current.payables >= 1.5
                  ? "good"
                  : "warn"
              }
              status={
                !current.payables || current.cashAndBank / current.payables >= 1.5
                  ? "Healthy"
                  : "Watch"
              }
            />
          </ul>
        </Card>
      </Row>
    </ModuleFrame>
  );
}

function BridgeRow({
  label,
  value,
  currency,
  subtotal = false,
}: {
  label: string;
  value: number;
  currency: string;
  subtotal?: boolean;
}) {
  return (
    <Tr highlight={subtotal}>
      <Td>{label}</Td>
      <Td align="right">{formatMoney(value, currency)}</Td>
    </Tr>
  );
}

function WorkingCapitalRow({
  label,
  current,
  previous,
  currency,
  higherIsWorse = false,
  strong = false,
}: {
  label: string;
  current: number;
  previous?: number;
  currency: string;
  higherIsWorse?: boolean;
  strong?: boolean;
}) {
  const movement = previous === undefined ? null : current - previous;
  const worsening =
    movement === null ? false : higherIsWorse ? movement > 0 : movement < 0;

  return (
    <Tr>
      <Td strong={strong}>{label}</Td>
      <Td align="right" strong={strong}>
        {formatMoney(current, currency)}
      </Td>
      <Td align="right">
        {movement === null
          ? "—"
          : formatMoney(movement, currency, { alwaysSigned: true })}
      </Td>
      <Td>
        {movement === null ? (
          <Badge>No comparative</Badge>
        ) : (
          <Badge tone={worsening ? "warn" : "good"}>
            {worsening ? "Watch" : "Healthy"}
          </Badge>
        )}
      </Td>
    </Tr>
  );
}

function Alert({
  heading,
  detail,
  tone,
  status,
}: {
  heading: string;
  detail: string;
  tone: "good" | "warn" | "bad";
  status: string;
}) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground">{heading}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{detail}</p>
      </div>
      <Badge tone={tone}>{status}</Badge>
    </li>
  );
}
