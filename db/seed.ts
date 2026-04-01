import { Client } from "pg";
import bcrypt from "bcryptjs";

const client = new Client({
  connectionString:
    process.env.DB_URL ??
    "postgresql://postgres:XXXXXXXXXXXXXXXXXXXXXXX@localhost:5432/tenant_db",
});

const N = 100;

const agencies: string[] = [];
for (let i = 1; i <= N; i++) agencies.push(`agency${i}`);

const users = agencies.map(function (agency, i) {
  return {
    name: "user1",
    email: `user1@agency${i + 1}.com`,
    password: "user1234",
    agency,
  };
});

async function seed() {
  await client.connect();

  try {
    for (const slug of agencies)
      await client.query("insert into agencies (slug) values ($1)", [slug]);

    for (const { email, password, agency } of users) {
      const password_hash = await bcrypt.hash(password, 10);
      await client.query("select create_user_fn($1, $2, $3)", [
        email,
        password_hash,
        agency,
      ]);
    }
  } catch (error) {
    console.error("seed failed", error);
  } finally {
    await client.end();
  }
}

seed();
