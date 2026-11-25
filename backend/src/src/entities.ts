import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from "typeorm";

export enum Role {
  FETCHER = "FETCHER",
  MILLER = "MILLER",
  MANAGER = "MANAGER",
  OWNER = "OWNER",
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
