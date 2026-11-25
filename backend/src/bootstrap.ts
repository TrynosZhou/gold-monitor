import bcrypt from "bcryptjs";
import { AppDataSource } from "./data-source";
import { User, Role } from "./entities";

const DEFAULT_USERS = [
  { fullName: "Stone Fetcher", username: "fetcher", role: Role.FETCHER, password: "ChangeMe123!" },
  { fullName: "Mill Operator", username: "miller", role: Role.MILLER, password: "ChangeMe123!" },
  { fullName: "Gold Manager", username: "manager", role: Role.MANAGER, password: "ChangeMe123!" },
  { fullName: "Mine Owner", username: "owner", role: Role.OWNER, password: "ChangeMe123!" },
  { fullName: "Administrator", username: "admin", role: Role.ADMIN, password: "admin" },
];

/**
 * Creates any default account that does not exist yet.
 * Existing accounts are never modified, so changed passwords are kept.
 */
export async function ensureDefaultUsers(): Promise<string[]> {
  const repo = AppDataSource.getRepository(User);
  const created: string[] = [];

  for (const { password, ...u } of DEFAULT_USERS) {
    if (await repo.findOneBy({ username: u.username })) continue;
    const passwordHash = await bcrypt.hash(password, 10);
    await repo.save(repo.create({ ...u, passwordHash }));
    created.push(u.username);
  }
  return created;
}
