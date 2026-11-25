import "reflect-metadata";
import bcrypt from "bcryptjs";
import { AppDataSource } from "./data-source";
import { User, Role } from "./entities";

async function seed() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(User);

  const people = [
    { fullName: "Stone Fetcher", username: "fetcher", role: Role.FETCHER },
    { fullName: "Mill Operator", username: "miller", role: Role.MILLER },
    { fullName: "Gold Manager", username: "manager", role: Role.MANAGER },
    { fullName: "Mine Owner", username: "owner", role: Role.OWNER },
  ];

  for (const p of people) {
    if (await repo.findOneBy({ username: p.username })) continue;
    const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
    await repo.save(repo.create({ ...p, passwordHash }));
  }

  console.log("Users seeded. Default password is ChangeMe123! -- change it immediately.");
  await AppDataSource.destroy();
}

seed();
