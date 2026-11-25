import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from "typeorm";

export enum Role {
  FETCHER = "FETCHER",
  MILLER = "MILLER",
  MANAGER = "MANAGER",
  OWNER = "OWNER",
  ADMIN = "ADMIN",
}

export enum PayoutStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  DISPUTED = "DISPUTED",
}

// Postgres returns NUMERIC as a string; convert it to a JS number.
const decimal = {
  to: (v?: number | null) => v,
  from: (v?: string | null) => (v == null ? null : parseFloat(v)),
};

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ length: 100 })
  fullName!: string;

  @Column({ length: 50, unique: true })
  username!: string;

  @Column({ select: false })
  passwordHash!: string;

  @Column({ type: "enum", enum: Role })
  role!: Role;

  @Column({ default: true })
  active!: boolean;
}

@Entity("stone_deliveries")
export class StoneDelivery {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: "fetcher_id" })
  fetcher!: User;

  @Column("int")
  wheelbarrowCount!: number;

  @Column({ type: "varchar", length: 100, nullable: true })
  pitLocation!: string | null;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @Column({ type: "timestamptz" })
  deliveredAt!: Date;

  @CreateDateColumn({ type: "timestamptz" })
  recordedAt!: Date;
}

@Entity("crushing_runs")
export class CrushingRun {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: "miller_id" })
  miller!: User;

  @Column("int")
  wheelbarrowsCrushed!: number;

  @Column({ type: "numeric", precision: 10, scale: 3, transformer: decimal })
  goldGrams!: number;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @Column({ type: "timestamptz" })
  crushedAt!: Date;

  @CreateDateColumn({ type: "timestamptz" })
  recordedAt!: Date;
}

@Entity("gold_receipts")
export class GoldReceipt {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: "manager_id" })
  manager!: User;

  @Column({ type: "numeric", precision: 10, scale: 3, transformer: decimal })
  grams!: number;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @Column({ type: "timestamptz" })
  receivedAt!: Date;

  @CreateDateColumn({ type: "timestamptz" })
  recordedAt!: Date;
}

@Entity("cash_payouts")
export class CashPayout {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: "manager_id" })
  manager!: User;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: "owner_id" })
  owner!: User;

  @Column({ type: "numeric", precision: 10, scale: 3, transformer: decimal })
  gramsSold!: number;

  @Column({ type: "numeric", precision: 12, scale: 2, transformer: decimal })
  pricePerGram!: number;

  @Column({ type: "numeric", precision: 14, scale: 2, transformer: decimal })
  totalCash!: number;

  @Column({ length: 3, default: "USD" })
  currency!: string;

  @Column({ type: "enum", enum: PayoutStatus, default: PayoutStatus.PENDING })
  status!: PayoutStatus;

  @Column({ type: "numeric", precision: 10, scale: 3, nullable: true, transformer: decimal })
  gramsConfirmed!: number | null;

  @Column({ type: "text", nullable: true })
  disputeNote!: string | null;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @Column({ type: "timestamptz" })
  paidAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  acknowledgedAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  recordedAt!: Date;
}

/**
 * Single-row table (id is always 1) holding the company branding and the
 * gold selling prices. Only administrators can change it.
 */
@Entity("app_settings")
export class AppSettings {
  @PrimaryColumn("int")
  id!: number;

  @Column({ length: 120 })
  companyName!: string;

  @Column({ type: "varchar", length: 200, nullable: true })
  motto!: string | null;

  /** Logo stored as a data URL (e.g. data:image/png;base64,...). */
  @Column({ type: "text", nullable: true })
  logoDataUrl!: string | null;

  /** ISO 4217 code used for every money figure, e.g. USD. */
  @Column({ length: 3, default: "USD" })
  currency!: string;

  @Column({ type: "numeric", precision: 12, scale: 2, default: 0, transformer: decimal })
  goldPricePerGram!: number;

  @Column({ type: "numeric", precision: 14, scale: 2, default: 0, transformer: decimal })
  goldPricePerKg!: number;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
