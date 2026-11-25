import { EntityManager } from "typeorm";
import { AppDataSource } from "./data-source";
import { AppSettings } from "./entities";

export const DEFAULT_SETTINGS = {
  companyName: "Gold Monitor",
  motto: null,
  logoDataUrl: null,
  currency: "USD",
  goldPricePerGram: 0,
  goldPricePerKg: 0,
};

/**
 * Returns the settings row, creating it with defaults on first use.
 * The insert ignores conflicts so two simultaneous first calls cannot fail.
 */
export async function getSettings(em: EntityManager = AppDataSource.manager): Promise<AppSettings> {
  const repo = em.getRepository(AppSettings);
  await repo
    .createQueryBuilder()
    .insert()
    .into(AppSettings)
    .values({ id: 1, ...DEFAULT_SETTINGS })
    .orIgnore()
    .execute();
  return (await repo.findOneByOrFail({ id: 1 }));
}

/** The branding every visitor may see, including people who are not logged in. */
export function toBranding(s: AppSettings) {
  return {
    companyName: s.companyName,
    motto: s.motto,
    logoDataUrl: s.logoDataUrl,
    currency: s.currency,
  };
}
