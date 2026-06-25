import { hashPassword } from "../lib/auth";
import { loadLocalEnv } from "../lib/load-env";
import { ensureMongoIndexes, getDb } from "../lib/mongodb";
import type { StaffDocument } from "../lib/repositories";

loadLocalEnv();

async function main() {
  const username = (process.env.ADMIN_USERNAME ?? process.env.VSC_AUTH_USERNAME ?? "admin").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? process.env.VSC_AUTH_PASSWORD;
  const email = (process.env.ADMIN_EMAIL ?? "admin@vsctruck.com").trim().toLowerCase();
  const name = (process.env.ADMIN_NAME ?? "Admin").trim();

  if (!password || password.length < 8) {
    throw new Error("Set ADMIN_PASSWORD or VSC_AUTH_PASSWORD with at least 8 characters");
  }

  await ensureMongoIndexes();
  const db = await getDb();
  const now = new Date();
  const existing = await db.collection<StaffDocument>("staff").findOne({ username });
  const update: Partial<StaffDocument> = {
    name,
    email,
    username,
    passwordHash: hashPassword(password),
    role: "admin",
    status: "active",
    updatedAt: now,
  };

  if (existing?._id) {
    await db.collection<StaffDocument>("staff").updateOne({ _id: existing._id }, { $set: update });
    console.log(`Updated admin staff "${username}"`);
    return;
  }

  await db.collection<StaffDocument>("staff").insertOne({
    ...(update as Omit<StaffDocument, "_id" | "createdAt">),
    createdAt: now,
  });
  console.log(`Created admin staff "${username}"`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
