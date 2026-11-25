import "reflect-metadata";
import { AppDataSource } from "./data-source";
import { ensureDefaultUsers } from "./bootstrap";

async function seed() {
  await AppDataSource.initialize();
  const created = await ensureDefaultUsers();
  console.log(
    created.length
      ? `Created users: ${created.join(", ")}`
      : "All default users already exist.",
  );
  console.log("Role accounts use ChangeMe123!; admin uses admin. Change them before real use.");
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
