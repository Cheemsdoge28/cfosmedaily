/**
 * Demo seed.
 *
 * Reproduces the figures the original demo dashboard showed, but as *stored
 * inputs* rather than pre-computed totals: revenue, COGS, opex, depreciation,
 * finance cost and tax, plus closing balances. Every subtotal the dashboard
 * displays (gross profit, EBITDA, net profit, margins, operating cash flow) is
 * recalculated from these, so the seeded numbers reconcile by construction.
 *
 * The figures below are in rupees. The original presented lakhs; the database
 * stores base currency units and the UI formats them back into lakhs/crores.
 *
 *   npm run db:seed
 *
 * Re-running is safe: everything is upserted on its natural key.
 */

import { randomBytes } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Not present — rely on the ambient environment.
  }
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL (or DIRECT_URL) must be set before seeding. See .env.example.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const L = 100_000; // one lakh, in rupees

/** Month key -> per-unit inputs, in lakhs, exactly as the demo presented them. */
type UnitFigures = {
  revenue: number;
  grossProfit: number;
  opex: number;
  /** EBITDA is gross profit minus opex; stated here only to derive the tail. */
  ebitda: number;
  netProfit: number;
  cash: number;
};

/**
 * FY 2026-27 actuals (April 2026 onwards). Business-unit figures add up to the
 * consolidated totals the original dashboard showed for each month.
 */
const ACTUALS: Record<string, Record<string, UnitFigures>> = {
  "2026-04-01": {
    Manufacturing: { revenue: 30.1, grossProfit: 11.85, opex: 6.2, ebitda: 5.65, netProfit: 3.86, cash: 15.4 },
    Trading: { revenue: 11.7, grossProfit: 4.45, opex: 2.66, ebitda: 1.79, netProfit: 1.15, cash: 6.6 },
  },
  "2026-05-01": {
    Manufacturing: { revenue: 31.4, grossProfit: 12.55, opex: 6.66, ebitda: 5.89, netProfit: 3.97, cash: 16.32 },
    Trading: { revenue: 11.8, grossProfit: 4.65, opex: 2.94, ebitda: 1.71, netProfit: 1.13, cash: 6.81 },
  },
  "2026-06-01": {
    Manufacturing: { revenue: 32.4, grossProfit: 12.9, opex: 6.85, ebitda: 6.05, netProfit: 4.08, cash: 18.08 },
    Trading: { revenue: 12.5, grossProfit: 4.9, opex: 3.05, ebitda: 1.85, netProfit: 1.22, cash: 7.75 },
  },
  "2026-07-01": {
    Manufacturing: { revenue: 31.1, grossProfit: 12.55, opex: 6.37, ebitda: 6.18, netProfit: 4.31, cash: 19.5 },
    Trading: { revenue: 12.2, grossProfit: 4.65, opex: 2.73, ebitda: 1.92, netProfit: 1.39, cash: 8.23 },
  },
  "2026-08-01": {
    Manufacturing: { revenue: 34.8, grossProfit: 13.62, opex: 6.44, ebitda: 7.18, netProfit: 4.76, cash: 22.4 },
    Trading: { revenue: 13.82, grossProfit: 5.29, opex: 2.73, ebitda: 2.56, netProfit: 1.66, cash: 9.45 },
  },
};

/** FY 2025-26 comparatives, scaled from the FY 2026-27 shape. */
const PRIOR_YEAR_FACTORS = [
  0.82, 0.83, 0.85, 0.84, 0.86, 0.88, 0.87, 0.89, 0.9, 0.88, 0.91, 0.93,
];

type SnapshotInput = {
  periodStart: Date;
  revenue: number;
  cogs: number;
  opex: number;
  depreciation: number;
  financeCost: number;
  taxExpense: number;
  cashAndBank: number;
  receivables: number;
  payables: number;
  inventory: number;
  capex: number;
  financingNet: number;
};

/**
 * Turns the presented figures into stored inputs.
 *
 * The demo only stated EBITDA and net profit, so the tail between them
 * (depreciation, finance cost, tax) is split on a fixed ratio rather than
 * invented per month — the split is stated here so a reviewer can see it.
 */
function toInputs(
  periodStart: string,
  figures: UnitFigures,
  balances: { receivables: number; payables: number; inventory: number; capex: number; financingNet: number },
): SnapshotInput {
  const tail = Math.max(0, figures.ebitda - figures.netProfit);

  return {
    periodStart: new Date(`${periodStart}T00:00:00Z`),
    revenue: figures.revenue * L,
    cogs: (figures.revenue - figures.grossProfit) * L,
    opex: figures.opex * L,
    depreciation: tail * 0.35 * L,
    financeCost: tail * 0.22 * L,
    taxExpense: tail * 0.43 * L,
    cashAndBank: figures.cash * L,
    receivables: balances.receivables * L,
    payables: balances.payables * L,
    inventory: balances.inventory * L,
    capex: balances.capex * L,
    financingNet: balances.financingNet * L,
  };
}

/** Working-capital balances scale with the month's trading volume. */
function balancesFor(revenue: number, unitShare: number) {
  // August consolidated anchors from the original dashboard.
  const scale = revenue / 48.62;
  return {
    receivables: 27.4 * scale * unitShare,
    payables: 18.65 * scale * unitShare,
    inventory: 22.8 * scale * unitShare,
    capex: 1.92 * scale * unitShare,
    financingNet: -1.81 * scale * unitShare,
  };
}

function isoMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

async function main() {
  console.log("Seeding RISEBIT CFO demo data\n");

  // ── Client ────────────────────────────────────────────────────────────────
  const client = await prisma.client.upsert({
    where: { slug: "demo-manufacturing" },
    update: {},
    create: {
      slug: "demo-manufacturing",
      name: "Demo Manufacturing Pvt. Ltd.",
      legalName: "Demo Manufacturing Private Limited",
      currency: "INR",
      fiscalYearStartMonth: 4,
    },
  });

  const unitNames = ["Manufacturing", "Trading"] as const;
  const units = new Map<string, string>();

  for (const [index, name] of unitNames.entries()) {
    const unit = await prisma.businessUnit.upsert({
      where: { clientId_name: { clientId: client.id, name } },
      update: {},
      create: { clientId: client.id, name, sortOrder: index },
    });
    units.set(name, unit.id);
  }

  // ── Fiscal years (April to March) ─────────────────────────────────────────
  const fyDefs = [
    { label: "FY 2025-26", start: "2025-04-01", end: "2026-03-31", isCurrent: false },
    { label: "FY 2026-27", start: "2026-04-01", end: "2027-03-31", isCurrent: true },
  ];

  const fiscalYears = new Map<string, string>();
  for (const def of fyDefs) {
    const fy = await prisma.fiscalYear.upsert({
      where: { clientId_label: { clientId: client.id, label: def.label } },
      update: { isCurrent: def.isCurrent },
      create: {
        clientId: client.id,
        label: def.label,
        startDate: new Date(`${def.start}T00:00:00Z`),
        endDate: new Date(`${def.end}T00:00:00Z`),
        isCurrent: def.isCurrent,
      },
    });
    fiscalYears.set(def.label, fy.id);
  }

  // ── Monthly snapshots ─────────────────────────────────────────────────────
  const unitShare: Record<string, number> = { Manufacturing: 0.716, Trading: 0.284 };
  let snapshotCount = 0;

  // FY 2026-27 actuals.
  for (const [periodStart, byUnit] of Object.entries(ACTUALS)) {
    for (const [unitName, figures] of Object.entries(byUnit)) {
      const inputs = toInputs(
        periodStart,
        figures,
        balancesFor(figures.revenue / (unitShare[unitName] ?? 1), unitShare[unitName] ?? 1),
      );

      await prisma.monthlySnapshot.upsert({
        where: {
          businessUnitId_periodStart: {
            businessUnitId: units.get(unitName)!,
            periodStart: inputs.periodStart,
          },
        },
        update: inputs,
        create: {
          ...inputs,
          clientId: client.id,
          businessUnitId: units.get(unitName)!,
          fiscalYearId: fiscalYears.get("FY 2026-27")!,
        },
      });
      snapshotCount += 1;
    }
  }

  // FY 2025-26 comparatives: the same shape, scaled month by month.
  const templateMonths = Object.values(ACTUALS);
  for (let offset = 0; offset < 12; offset += 1) {
    const calendarMonth = ((3 + offset) % 12) + 1; // April = 4
    const year = calendarMonth >= 4 ? 2025 : 2026;
    const periodStart = isoMonth(year, calendarMonth);
    const factor = PRIOR_YEAR_FACTORS[offset]!;
    const template = templateMonths[offset % templateMonths.length]!;

    for (const unitName of unitNames) {
      const base = template[unitName]!;
      const scaled: UnitFigures = {
        revenue: base.revenue * factor,
        grossProfit: base.grossProfit * factor * 0.97,
        opex: base.opex * factor * 1.02,
        ebitda: base.grossProfit * factor * 0.97 - base.opex * factor * 1.02,
        netProfit:
          (base.grossProfit * factor * 0.97 - base.opex * factor * 1.02) * 0.68,
        cash: base.cash * factor * 0.9,
      };

      const inputs = toInputs(
        periodStart,
        scaled,
        balancesFor(scaled.revenue / unitShare[unitName]!, unitShare[unitName]!),
      );

      await prisma.monthlySnapshot.upsert({
        where: {
          businessUnitId_periodStart: {
            businessUnitId: units.get(unitName)!,
            periodStart: inputs.periodStart,
          },
        },
        update: inputs,
        create: {
          ...inputs,
          clientId: client.id,
          businessUnitId: units.get(unitName)!,
          fiscalYearId: fiscalYears.get("FY 2025-26")!,
        },
      });
      snapshotCount += 1;
    }
  }
  console.log(`  ${snapshotCount} monthly snapshots`);

  // ── Expense mix, ageing, counterparties, banks ────────────────────────────
  const allSnapshots = await prisma.monthlySnapshot.findMany({
    where: { clientId: client.id },
  });

  let detailCount = 0;

  for (const snapshot of allSnapshots) {
    const cogs = Number(snapshot.cogs);
    const opex = Number(snapshot.opex);
    const depreciation = Number(snapshot.depreciation);
    const financeCost = Number(snapshot.financeCost);

    // Allocation that sums exactly to the period's cost base.
    const categories: [string, number][] = [
      ["Materials", cogs * 0.93],
      ["Direct labour", cogs * 0.07],
      ["Employee cost", opex * 0.52],
      ["Admin & selling", opex * 0.37],
      ["Other operating", opex * 0.11],
      ["Depreciation", depreciation],
      ["Finance cost", financeCost],
    ];

    for (const [category, amount] of categories) {
      await prisma.expenseLine.upsert({
        where: {
          businessUnitId_periodStart_category: {
            businessUnitId: snapshot.businessUnitId,
            periodStart: snapshot.periodStart,
            category,
          },
        },
        update: { amount },
        create: {
          clientId: client.id,
          businessUnitId: snapshot.businessUnitId,
          periodStart: snapshot.periodStart,
          category,
          amount,
        },
      });
      detailCount += 1;
    }

    // Ageing profiles, as a share of the closing balance. The demo uses 30-day
    // bands; a real client's bands come from its own accounting system and are
    // stored exactly as reported.
    const agingShapes = {
      RECEIVABLE: [
        ["Current", 0.46],
        ["1-30 Days", 0.24],
        ["31-60 Days", 0.15],
        ["61-90 Days", 0.09],
        ["90+ Days", 0.06],
      ],
      PAYABLE: [
        ["Current", 0.38],
        ["1-30 Days", 0.31],
        ["31-60 Days", 0.18],
        ["61-90 Days", 0.08],
        ["90+ Days", 0.05],
      ],
    } as const satisfies Record<string, readonly (readonly [string, number])[]>;

    for (const ledger of ["RECEIVABLE", "PAYABLE"] as const) {
      const total =
        ledger === "RECEIVABLE"
          ? Number(snapshot.receivables)
          : Number(snapshot.payables);

      for (const [order, band] of agingShapes[ledger].entries()) {
        const [bucketLabel, share] = band;
        await prisma.agingBucket.upsert({
          where: {
            businessUnitId_periodStart_ledger_bucketLabel: {
              businessUnitId: snapshot.businessUnitId,
              periodStart: snapshot.periodStart,
              ledger,
              bucketLabel,
            },
          },
          update: { amount: total * share, bucketOrder: order },
          create: {
            clientId: client.id,
            businessUnitId: snapshot.businessUnitId,
            periodStart: snapshot.periodStart,
            ledger,
            bucketLabel,
            bucketOrder: order,
            amount: total * share,
          },
        });
        detailCount += 1;
      }
    }

    // Counterparty detail.
    const customers: [string, number, number][] = [
      ["Alpha Retail", 0.21, 18],
      ["Bright Distributors", 0.15, 52],
      ["Northstar Foods", 0.12, 71],
      ["Urban Mart", 0.11, 34],
      ["Other customers", 0.41, 26],
    ];
    const suppliers: [string, number, number][] = [
      ["Prime Packaging", 0.2, 12],
      ["Metro Materials", 0.16, 21],
      ["Swift Logistics", 0.12, 29],
      ["Other suppliers", 0.52, 24],
    ];

    for (const [ledger, rows, total] of [
      ["RECEIVABLE", customers, Number(snapshot.receivables)],
      ["PAYABLE", suppliers, Number(snapshot.payables)],
    ] as const) {
      for (const [name, share, ageDays] of rows) {
        const dueDate = new Date(snapshot.periodStart);
        dueDate.setUTCDate(dueDate.getUTCDate() + 45 - ageDays);

        await prisma.counterpartyBalance.upsert({
          where: {
            businessUnitId_periodStart_ledger_name: {
              businessUnitId: snapshot.businessUnitId,
              periodStart: snapshot.periodStart,
              ledger,
              name,
            },
          },
          update: { amount: total * share, ageDays },
          create: {
            clientId: client.id,
            businessUnitId: snapshot.businessUnitId,
            periodStart: snapshot.periodStart,
            ledger,
            name,
            amount: total * share,
            ageDays,
            dueDate: ledger === "PAYABLE" ? dueDate : null,
          },
        });
        detailCount += 1;
      }
    }
  }
  console.log(`  ${detailCount} expense / ageing / counterparty rows`);

  // ── Bank accounts and month-end reconciliation ────────────────────────────
  const accountDefs = [
    { name: "Operating A/c — HDFC 4412", type: "OPERATING" as const, unit: "Manufacturing", share: 0.58 },
    { name: "Collection A/c — ICICI 8890", type: "COLLECTION" as const, unit: "Manufacturing", share: 0.31 },
    { name: "Reserve A/c — SBI 2207", type: "RESERVE" as const, unit: "Trading", share: 0.11 },
  ];

  let balanceCount = 0;
  for (const [index, def] of accountDefs.entries()) {
    const account = await prisma.bankAccount.upsert({
      where: { clientId_name: { clientId: client.id, name: def.name } },
      update: {},
      create: {
        clientId: client.id,
        businessUnitId: units.get(def.unit)!,
        name: def.name,
        accountType: def.type,
        sortOrder: index,
      },
    });

    // Consolidated cash for each month, split across the accounts.
    const byMonth = new Map<string, number>();
    for (const snapshot of allSnapshots) {
      const key = snapshot.periodStart.toISOString().slice(0, 10);
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(snapshot.cashAndBank));
    }

    for (const [iso, totalCash] of byMonth) {
      const bankBalance = totalCash * def.share;
      // The collection account carries an uncleared item, as it did in the demo.
      const ledgerBalance =
        def.type === "COLLECTION" ? bankBalance + 0.07 * L : bankBalance;

      await prisma.bankBalance.upsert({
        where: {
          bankAccountId_periodStart: {
            bankAccountId: account.id,
            periodStart: new Date(`${iso}T00:00:00Z`),
          },
        },
        update: { ledgerBalance, bankBalance },
        create: {
          bankAccountId: account.id,
          periodStart: new Date(`${iso}T00:00:00Z`),
          ledgerBalance,
          bankBalance,
        },
      });
      balanceCount += 1;
    }
  }
  console.log(`  ${accountDefs.length} bank accounts, ${balanceCount} monthly balances`);

  // ── Management targets ────────────────────────────────────────────────────
  const targets = [
    ["REVENUE", 46 * L],
    ["GROSS_MARGIN_PCT", 37.5],
    ["EBITDA_MARGIN_PCT", 19],
    ["NET_MARGIN_PCT", 12],
    ["DSO_DAYS", 45],
    ["DPO_DAYS", 40],
    ["CASH_BALANCE", 28 * L],
    ["CASH_CONVERSION_DAYS", 34],
  ] as const;

  // Annual targets carry a null periodStart. Postgres treats NULLs as distinct
  // in a unique index, so the compound key cannot be used for an upsert here —
  // find the existing row first instead.
  for (const [metric, value] of targets) {
    const fiscalYearId = fiscalYears.get("FY 2026-27")!;
    const existing = await prisma.kpiTarget.findFirst({
      where: { fiscalYearId, metric, periodStart: null },
    });

    if (existing) {
      await prisma.kpiTarget.update({
        where: { id: existing.id },
        data: { targetValue: value },
      });
    } else {
      await prisma.kpiTarget.create({
        data: { clientId: client.id, fiscalYearId, metric, targetValue: value },
      });
    }
  }
  console.log(`  ${targets.length} KPI targets`);

  await prisma.zohoConnection.upsert({
    where: { clientId: client.id },
    update: {},
    create: { clientId: client.id, region: process.env.ZOHO_REGION ?? "in" },
  });

  // ── Accounts ──────────────────────────────────────────────────────────────
  function strongPassword(): string {
    return `${randomBytes(9).toString("base64url")}#7Aa`;
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@risebitcfo.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || strongPassword();
  const demoPassword = process.env.SEED_DEMO_PASSWORD || strongPassword();

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "RISEBIT Administrator",
      role: "PLATFORM_ADMIN",
      passwordHash: await bcrypt.hash(adminPassword, 12),
      mustChangePassword: !process.env.SEED_ADMIN_PASSWORD,
    },
  });

  await prisma.user.upsert({
    where: { email: "cfo@demo-manufacturing.test" },
    update: {},
    create: {
      email: "cfo@demo-manufacturing.test",
      name: "Demo Client CFO",
      role: "CLIENT_ADMIN",
      clientId: client.id,
      passwordHash: await bcrypt.hash(demoPassword, 12),
      mustChangePassword: !process.env.SEED_DEMO_PASSWORD,
    },
  });

  console.log("\n  Accounts");
  console.log(`    platform admin : ${adminEmail}`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(`    password       : ${adminPassword}   (shown once — must be changed at first sign-in)`);
  }
  console.log(`    demo client    : cfo@demo-manufacturing.test`);
  if (!process.env.SEED_DEMO_PASSWORD) {
    console.log(`    password       : ${demoPassword}   (shown once — must be changed at first sign-in)`);
  }

  console.log("\nDone.\n");
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
