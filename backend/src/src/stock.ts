import { EntityManager, ObjectLiteral } from "typeorm";
import { AppDataSource } from "./data-source";
import { StoneDelivery, CrushingRun, GoldReceipt, CashPayout, PayoutStatus } from "./entities";

/** One milligram. Differences smaller than this are rounding noise. */
export const TOLERANCE = 0.001;

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const near = (n: number) => Math.abs(n) <= TOLERANCE;

/**
 * Serialises every write that changes gold balances, so two requests cannot
 * both pass the same stock check. Released automatically at transaction end.
 */
export async function lockGoldLedger(em: EntityManager) {
  await em.query("SELECT pg_advisory_xact_lock(4242)");
}

/** Single source of truth for every balance and reconciliation figure. */
export async function getStock(em: EntityManager = AppDataSource.manager) {
  const sum = (entity: any, column: string, where: ObjectLiteral = {}) =>
    em.getRepository(entity).sum(column, where).then((v: number | null) => Number(v) || 0);

  const delivered = await sum(StoneDelivery, "wheelbarrowCount");
  const crushed = await sum(CrushingRun, "wheelbarrowsCrushed");
  const produced = await sum(CrushingRun, "goldGrams");
  const received = await sum(GoldReceipt, "grams");
  const sold = await sum(CashPayout, "gramsSold");
  const confirmed = await sum(CashPayout, "gramsConfirmed", { status: PayoutStatus.CONFIRMED });
  const cashPaid = await sum(CashPayout, "totalCash");

  return {
    wheelbarrowsAvailable: delivered - crushed,

    goldProduced: r3(produced),
    goldReceived: r3(received),
    goldSold: r3(sold),
    goldConfirmedByOwner: r3(confirmed),

    goldAwaitingReceipt: r3(produced - received),
    goldInVault: r3(received - sold),
    goldPendingOwnerConfirmation: r3(sold - confirmed),

    cashPaid: r2(cashPaid),

    reconciliation: {
      producedVsReceived: r3(produced - received),
      receivedVsSold: r3(received - sold),
      soldVsConfirmed: r3(sold - confirmed),
      isFullyMatched: near(produced - received) && near(received - sold) && near(sold - confirmed),
    },
  };
}
