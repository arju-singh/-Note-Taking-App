// Zero-install local Postgres for development.
//
// Uses the real PostgreSQL binaries shipped by the `embedded-postgres`
// package, so this works on a machine with no Homebrew/Docker/system Postgres.
// Data lives in .localdb/pgdata (gitignored) and survives restarts.
//
//   npm run db:local        init (first run) + start + apply schema
//   npm run db:local:stop   stop the server
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, ".localdb", "pgdata");
const port = Number(process.env.LOCAL_PG_PORT ?? 5433);
const url = (db) => `postgresql://postgres@127.0.0.1:${port}/${db}`;

// Unix sockets stay off: the socket path (107 byte limit) overflows under deep
// project paths, and everything here talks TCP on 127.0.0.1 anyway.
const serverOpts = `-p ${port} -c unix_socket_directories='' -c listen_addresses=127.0.0.1`;

function bin(name) {
  // The package blocks "./package.json" in its exports map, so resolve its
  // main entry and walk up to the package root that holds native/bin.
  const pkg = `@embedded-postgres/${process.platform}-${process.arch}`;
  let dir;
  try {
    dir = path.dirname(createRequire(import.meta.url).resolve(pkg));
  } catch {
    throw new Error(
      `No embedded Postgres binaries for ${process.platform}-${process.arch}. ` +
        `Install Postgres yourself and point DATABASE_URL at it.`
    );
  }
  for (; dir !== path.dirname(dir); dir = path.dirname(dir)) {
    const candidate = path.join(dir, "native", "bin", name);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`${pkg} has no native/bin/${name}. Reinstall node_modules.`);
}

const pgctl = (...args) =>
  execFileSync(bin("pg_ctl"), ["-D", dataDir, ...args], { stdio: "inherit" });

function running() {
  try {
    execFileSync(bin("pg_ctl"), ["-D", dataDir, "status"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function sql(db, text) {
  const client = new Client({ connectionString: url(db) });
  await client.connect();
  try {
    return await client.query(text);
  } finally {
    await client.end();
  }
}

if (process.argv[2] === "stop") {
  if (running()) pgctl("-m", "fast", "-w", "stop");
  else console.log("local Postgres is not running");
} else {
  if (!existsSync(dataDir)) {
    mkdirSync(path.dirname(dataDir), { recursive: true });
    execFileSync(bin("initdb"), ["-D", dataDir, "-U", "postgres", "-A", "trust", "--encoding=UTF8"], { stdio: "inherit" });
  }
  // -w: pg_ctl returns only once the server accepts connections.
  if (running()) console.log(`local Postgres already running on port ${port}`);
  else pgctl("-l", path.join(root, ".localdb", "postgres.log"), "-o", serverOpts, "-w", "start");

  const { rowCount } = await sql("postgres", "SELECT 1 FROM pg_database WHERE datname = 'peacock'");
  if (!rowCount) await sql("postgres", "CREATE DATABASE peacock");
  await sql("peacock", readFileSync(path.join(root, "sql", "001_init.sql"), "utf8"));
  console.log(`DATABASE_URL=${url("peacock")}`);
}
