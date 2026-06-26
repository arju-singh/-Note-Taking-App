// Seeds two demo users so the app has test credentials out of the box.
// Run with: npm run db:seed   (loads .env via tsx --env-file)
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function upsertUser(email: string, password: string) {
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [email, hash]
  );
  console.log(`  seeded ${email} / ${password}`);
}

async function main() {
  console.log("Seeding demo users:");
  await upsertUser("demo@peacock.app", "password123");
  await upsertUser("alice@peacock.app", "password123");
  await pool.end();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
