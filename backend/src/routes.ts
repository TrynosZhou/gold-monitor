import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { AppDataSource } from "./data-source";
import {
  User, Role, StoneDelivery, CrushingRun, GoldReceipt, CashPayout, PayoutStatus, AppSettings,
} from "./entities";
import { requireAuth } from "./auth";
import { getStock, lockGoldLedger, TOLERANCE } from "./stock";
import { BusinessError } from "./errors";
import { getSettings, toBranding } from "./settings";

export const api = Router();
const db = AppDataSource;

// ---------- Validation schemas ----------
const deliverySchema = z.object({
  wheelbarrowCount: z.number().int().min(1).max(1000),
  pitLocation: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  deliveredAt: z.string().datetime().optional(),
});

const crushingSchema = z.object({
  wheelbarrowsCrushed: z.number().int().min(1).max(1000),
  goldGrams: z.number().min(0).max(100000),
  notes: z.string().max(500).optional(),
  crushedAt: z.string().datetime().optional(),
});

const receiptSchema = z.object({
  grams: z.number().positive().max(100000),
  notes: z.string().max(500).optional(),
  receivedAt: z.string().datetime().optional(),
});

const payoutSchema = z.object({
  ownerId: z.string().uuid(),
  gramsSold: z.number().positive().max(100000),
  pricePerGram: z.number().positive(),
  notes: z.string().max(500).optional(),
  paidAt: z.string().datetime().optional(),
});

const LOGO_MAX_CHARS = 2_800_000; // fits a 1.5 MB image once base64 encoded (about 2.1 million characters)

const settingsSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(120),
  motto: z.string().trim().max(200).nullable().optional(),
  logoDataUrl: z
    .string()
    .max(LOGO_MAX_CHARS, "Logo is too large. Use an image under 1.5 MB.")
    .regex(/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/, "Logo must be a PNG, JPEG, WebP or SVG image")
    .nullable()
    .optional(),
  currency: z.string().regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code such as USD"),
  goldPricePerGram: z.number().positive().max(10_000_000),
  goldPricePerKg: z.number().positive().max(10_000_000_000),
});

const confirmSchema = z.object({
  gramsConfirmed: z.number().min(0).max(100000),
  disputeNote: z.string().max(500).optional(),
});

// ---------- Health ----------
api.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ---------- Settings: branding is public (login page), prices need a login ----------
api.get("/settings/branding", async (_req, res) => {
  res.json(toBranding(await getSettings()));
});

// ---------- Auth ----------
api.post("/auth/login", async (req, res) => {
  const { username, password } = z
    .object({ username: z.string(), password: z.string() })
    .parse(req.body);

  const user = await db.getRepository(User).findOne({
    where: { username },
    select: { id: true, fullName: true, role: true, active: true, passwordHash: true },
  });

  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { sub: user.id, name: user.fullName, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: "12h" },
  );

  res.json({ token, user: { id: user.id, name: user.fullName, role: user.role } });
});

// Any logged-in user (every role) can change their own password.
api.post("/auth/change-password", requireAuth(), async (req, res) => {
  const { currentPassword, newPassword } = z
    .object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(128) })
    .parse(req.body);

  const repo = db.getRepository(User);
  const user = await repo.findOne({
    where: { id: req.user!.sub },
    select: { id: true, active: true, passwordHash: true },
  });
  if (!user || !user.active) throw new BusinessError(401, "Account not found or inactive");

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new BusinessError(400, "Current password is incorrect");
  }
  if (currentPassword === newPassword) {
    throw new BusinessError(400, "The new password must be different from the current one");
  }

  await repo.update({ id: user.id }, { passwordHash: await bcrypt.hash(newPassword, 10) });
  res.json({ message: "Password changed" });
});

// ---------- Summary and users ----------
api.get("/summary", requireAuth(), async (_req, res) => {
  res.json(await getStock());
});

api.get("/settings", requireAuth(), async (_req, res) => {
  const s = await getSettings();
  res.json({
    ...toBranding(s),
    goldPricePerGram: Number(s.goldPricePerGram),
    goldPricePerKg: Number(s.goldPricePerKg),
    updatedAt: s.updatedAt,
  });
});

// Only administrators can change company settings. The logo is sent as a data URL;
// omitting logoDataUrl keeps the current logo, sending null removes it.
api.put("/settings", requireAuth(Role.ADMIN), async (req, res) => {
  const body = settingsSchema.parse(req.body);

  const saved = await db.transaction(async (em) => {
    const repo = em.getRepository(AppSettings);
    const current = await getSettings(em);

    current.companyName = body.companyName;
    current.motto = body.motto ? body.motto.trim() || null : null;
    if (body.logoDataUrl !== undefined) current.logoDataUrl = body.logoDataUrl;
    current.currency = body.currency;
    current.goldPricePerGram = body.goldPricePerGram;
    current.goldPricePerKg = body.goldPricePerKg;

    return repo.save(current);
  });

  res.json({
    ...toBranding(saved),
    goldPricePerGram: Number(saved.goldPricePerGram),
    goldPricePerKg: Number(saved.goldPricePerKg),
    updatedAt: saved.updatedAt,
  });
});

api.get("/users/owners", requireAuth(Role.MANAGER), async (_req, res) => {
  res.json(
    await db.getRepository(User).find({
      where: { role: Role.OWNER, active: true },
      select: { id: true, fullName: true },
    }),
  );
});

// ---------- Stone deliveries (FETCHER) ----------
api.post("/deliveries", requireAuth(Role.FETCHER), async (req, res) => {
  const body = deliverySchema.parse(req.body);
  const repo = db.getRepository(StoneDelivery);

  const saved = await repo.save(
    repo.create({
      fetcher: { id: req.user!.sub } as User,
      wheelbarrowCount: body.wheelbarrowCount,
      pitLocation: body.pitLocation ?? null,
      notes: body.notes ?? null,
      deliveredAt: body.deliveredAt ? new Date(body.deliveredAt) : new Date(),
    }),
  );
  res.status(201).json(saved);
});

api.get("/deliveries", requireAuth(Role.FETCHER, Role.MANAGER, Role.OWNER, Role.ADMIN), async (req, res) => {
  const where = req.user!.role === Role.FETCHER ? { fetcher: { id: req.user!.sub } } : {};
  res.json(
    await db.getRepository(StoneDelivery).find({
      where,
      relations: { fetcher: true },
      order: { deliveredAt: "DESC" },
      take: 100,
    }),
  );
});

// ---------- Crushing runs (MILLER) ----------
api.post("/crushing", requireAuth(Role.MILLER), async (req, res) => {
  const body = crushingSchema.parse(req.body);

  const saved = await db.transaction(async (em) => {
    await lockGoldLedger(em);

    const stock = await getStock(em);
    if (body.wheelbarrowsCrushed > stock.wheelbarrowsAvailable) {
      throw new BusinessError(
        409,
        `Only ${stock.wheelbarrowsAvailable} wheelbarrows are waiting to be crushed`,
      );
    }

    const repo = em.getRepository(CrushingRun);
    return repo.save(
      repo.create({
        miller: { id: req.user!.sub } as User,
        wheelbarrowsCrushed: body.wheelbarrowsCrushed,
        goldGrams: body.goldGrams,
        notes: body.notes ?? null,
        crushedAt: body.crushedAt ? new Date(body.crushedAt) : new Date(),
      }),
    );
  });

  res.status(201).json(saved);
});

api.get("/crushing", requireAuth(Role.MILLER, Role.MANAGER, Role.OWNER, Role.ADMIN), async (req, res) => {
  const where = req.user!.role === Role.MILLER ? { miller: { id: req.user!.sub } } : {};
  res.json(
    await db.getRepository(CrushingRun).find({
      where,
      relations: { miller: true },
      order: { crushedAt: "DESC" },
      take: 100,
    }),
  );
});

// ---------- Gold receipts (MANAGER) ----------
api.post("/gold-receipts", requireAuth(Role.MANAGER), async (req, res) => {
  const body = receiptSchema.parse(req.body);

  const saved = await db.transaction(async (em) => {
    await lockGoldLedger(em);

    const stock = await getStock(em);
    if (body.grams > stock.goldAwaitingReceipt + TOLERANCE) {
      throw new BusinessError(
        409,
        `Only ${stock.goldAwaitingReceipt} g has been produced and not yet received. ` +
          `You entered ${body.grams} g.`,
      );
    }

    const repo = em.getRepository(GoldReceipt);
    return repo.save(
      repo.create({
        manager: { id: req.user!.sub } as User,
        grams: body.grams,
        notes: body.notes ?? null,
        receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date(),
      }),
    );
  });

  res.status(201).json(saved);
});

api.get("/gold-receipts", requireAuth(Role.MANAGER, Role.OWNER, Role.ADMIN), async (_req, res) => {
  res.json(
    await db.getRepository(GoldReceipt).find({
      relations: { manager: true },
      order: { receivedAt: "DESC" },
      take: 100,
    }),
  );
});

// ---------- Cash payouts (MANAGER records, OWNER confirms) ----------
api.post("/payouts", requireAuth(Role.MANAGER), async (req, res) => {
  const body = payoutSchema.parse(req.body);

  const saved = await db.transaction(async (em) => {
    await lockGoldLedger(em);

    const settings = await getSettings(em);
    const owner = await em.getRepository(User).findOneBy({ id: body.ownerId, role: Role.OWNER });
    if (!owner) throw new BusinessError(400, "Owner not found");

    const stock = await getStock(em);
    if (body.gramsSold > stock.goldInVault + TOLERANCE) {
      throw new BusinessError(
        409,
        `Only ${stock.goldInVault} g is in the vault. You entered ${body.gramsSold} g.`,
      );
    }

    const repo = em.getRepository(CashPayout);
    return repo.save(
      repo.create({
        manager: { id: req.user!.sub } as User,
        owner,
        gramsSold: body.gramsSold,
        pricePerGram: body.pricePerGram,
        totalCash: Math.round(body.gramsSold * body.pricePerGram * 100) / 100,
        currency: settings.currency,
        status: PayoutStatus.PENDING,
        notes: body.notes ?? null,
        paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
      }),
    );
  });

  res.status(201).json(saved);
});

api.get("/payouts", requireAuth(Role.MANAGER, Role.OWNER, Role.ADMIN), async (req, res) => {
  const where = req.user!.role === Role.OWNER ? { owner: { id: req.user!.sub } } : {};
  res.json(
    await db.getRepository(CashPayout).find({
      where,
      relations: { owner: true, manager: true },
      order: { paidAt: "DESC" },
    }),
  );
});

api.patch("/payouts/:id/confirm", requireAuth(Role.OWNER), async (req, res) => {
  const body = confirmSchema.parse(req.body);
  const repo = db.getRepository(CashPayout);
  const payoutId = String(req.params.id);

  const payout = await repo.findOne({
    where: { id: payoutId, owner: { id: req.user!.sub } },
    relations: { owner: true, manager: true },
  });
  if (!payout) throw new BusinessError(404, "Payout not found");
  if (payout.status !== PayoutStatus.PENDING) {
    throw new BusinessError(409, "This payout has already been reviewed");
  }

  const matches = Math.abs(body.gramsConfirmed - payout.gramsSold) <= TOLERANCE;

  payout.gramsConfirmed = body.gramsConfirmed;
  payout.status = matches ? PayoutStatus.CONFIRMED : PayoutStatus.DISPUTED;
  payout.disputeNote = matches
    ? null
    : body.disputeNote ??
      `Owner received ${body.gramsConfirmed} g, but ${payout.gramsSold} g was sold`;
  payout.acknowledgedAt = new Date();

  res.json(await repo.save(payout));
});
