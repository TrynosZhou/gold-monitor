import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import { User, StoneDelivery, CrushingRun, GoldReceipt, CashPayout, AppSettings } from "./entities";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [User, StoneDelivery, CrushingRun, GoldReceipt, CashPayout, AppSettings],
  // Development convenience only. In production, generate and run migrations instead.
  synchronize: process.env.NODE_ENV !== "production",
  logging: false,
});
