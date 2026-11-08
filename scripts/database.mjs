import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";

const local = resolve(".local");
mkdirSync(local, { recursive: true });
const secretsPath = resolve(local, "development.json");
if (!existsSync(secretsPath))
  writeFileSync(
    secretsPath,
    JSON.stringify(
      {
        admin: randomBytes(24).toString("hex"),
        app: randomBytes(24).toString("hex"),
        demo: randomBytes(15).toString("base64url"),
      },
      null,
      2,
    ),
  );
const secrets = JSON.parse(readFileSync(secretsPath, "utf8"));
const pg = new EmbeddedPostgres({
  databaseDir: resolve(local, "postgres"),
  user: "postgres",
  password: secrets.admin,
  port: 55432,
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: (message) => console.error(String(message)),
});
if (!existsSync(resolve(local, "postgres", "PG_VERSION")))
  await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
for (const name of ["teamflow", "teamflow_test"]) {
  const result = await client.query(
    "SELECT 1 FROM pg_database WHERE datname=$1",
    [name],
  );
  if (!result.rowCount)
    await client.query(
      `CREATE DATABASE ${name} WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`,
    );
}
const role = await client.query(
  "SELECT 1 FROM pg_roles WHERE rolname='teamflow_app'",
);
if (!role.rowCount)
  await client.query(
    `CREATE ROLE teamflow_app LOGIN PASSWORD '${secrets.app}' NOSUPERUSER NOCREATEDB NOCREATEROLE`,
  );
await client.end();
const url = (user, password, db) =>
  `postgresql+psycopg://${user}:${password}@127.0.0.1:55432/${db}`;
if (!existsSync(resolve("api", ".env")))
  writeFileSync(
    resolve("api", ".env"),
    `DATABASE_URL=${url("teamflow_app", secrets.app, "teamflow")}\nMIGRATION_DATABASE_URL=${url("postgres", secrets.admin, "teamflow")}\nTEST_DATABASE_URL=${url("postgres", secrets.admin, "teamflow_test")}\nDEMO_PASSWORD=${secrets.demo}\nWEB_ORIGIN=http://localhost:3000\nCOOKIE_SECURE=false\n`,
  );
writeFileSync(
  resolve(local, "DEMO_LOGIN.txt"),
  `Local-only demo accounts\n\nLead: asha@demoworks.test\nContributor: nila@demoworks.test\nReviewer: sami@demoworks.test\nShared demo password: ${secrets.demo}\n\nDo not deploy these accounts or commit this file.\n`,
);
console.log(
  "PostgreSQL ready on 127.0.0.1:55432. Local credentials saved in .local/DEMO_LOGIN.txt.",
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 60000);
