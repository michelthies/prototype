import "dotenv/config";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { resolve as resolvePath } from "node:path";
import { writeFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";

const isLocal = process.argv.includes("--local");

let ips: Record<string, string> = {};
try {
  ips = JSON.parse(readFileSync("ips.json", "utf8"));
} catch {}

const vpsIp: string = isLocal ? "127.0.0.1" : ips["nuernberg-vps"];

let targetUrls: Record<string, string>;
if (isLocal) {
  targetUrls = {
    pg: "http://localhost:8787",
    "pg-pool": "http://localhost:8788",
    pgbouncer: "http://localhost:8789",
    postgrest: "http://localhost:8790",
    hyperdrive: "http://localhost:8791",
    node: "http://localhost:3001",
  };
} else {
  targetUrls = {
    pg: `https://pg-cfworker.${process.env.WORKER_SUBDOMAIN}`,
    "pg-pool": `https://pg-pool-cfworker.${process.env.WORKER_SUBDOMAIN}`,
    pgbouncer: `https://pgbouncer-cfworker.${process.env.WORKER_SUBDOMAIN}`,
    postgrest: `https://postgrest-cfworker.${process.env.WORKER_SUBDOMAIN}`,
    hyperdrive: `https://hyperdrive-cfworker.${process.env.WORKER_SUBDOMAIN}`,
    "pg-pop": `https://pg-cfworker-pop.${process.env.WORKER_SUBDOMAIN}`,
    "pg-pool-pop": `https://pg-pool-cfworker-pop.${process.env.WORKER_SUBDOMAIN}`,
    "pgbouncer-pop": `https://pgbouncer-cfworker-pop.${process.env.WORKER_SUBDOMAIN}`,
    "postgrest-pop": `https://postgrest-cfworker-pop.${process.env.WORKER_SUBDOMAIN}`,
    "hyperdrive-pop": `https://hyperdrive-cfworker-pop.${process.env.WORKER_SUBDOMAIN}`,
    node: `https://${process.env.VPS_DOMAIN}:3001`,
  };
}

let dropletIps: Record<string, string>;
if (isLocal) {
  dropletIps = { local: "127.0.0.1" };
} else {
  dropletIps = {
    london: ips["london-droplet"],
    "new-york": ips["new-york-droplet"],
    singapore: ips["singapore-droplet"],
  };
}

const processHome = process.env.HOME;
if (!processHome) throw new Error("HOME not set");

const sshArgs = [
  "-i",
  resolvePath(processHome, ".ssh/SSSSSSSSSS"),
  "-o",
  "StrictHostKeyChecking=no",
  "-o",
  "BatchMode=yes",
  "-o",
  "ControlMaster=auto",
  "-o",
  "ControlPath=/tmp/ssh-test-%h-%p-%r",
  "-o",
  "ControlPersist=300s",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function execSsh(
  ip: string,
  command: string,
  opts: { input?: string } = {},
): string {
  if (isLocal) {
    return execFileSync("bash", ["-c", command], {
      encoding: "utf8",
      ...opts,
    }).trim();
  } else {
    return execFileSync("ssh", [...sshArgs, `root@${ip}`, command], {
      encoding: "utf8",
      ...opts,
    }).trim();
  }
}

function sshRead(ip: string, filePath: string): string {
  if (isLocal) {
    return readFileSync(filePath, "utf8");
  } else {
    return execSsh(ip, `cat ${filePath}`);
  }
}

const execRemoteSql = (sql: string) =>
  execSsh(
    vpsIp,
    "docker exec -i psql-db psql -U postgres -d tenant_db -tA --no-psqlrc",
    { input: sql },
  );

function nextRunDir(): string {
  mkdirSync("results", { recursive: true });
  const nums = readdirSync("results")
    .filter((d) => /^run\d+$/.test(d))
    .map((d) => parseInt(d.slice(3)));
  const runDir = `results/run${nums.length ? Math.max(...nums) + 1 : 1}`;
  mkdirSync(runDir, { recursive: true });
  return runDir;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function parseRoutingLogs(stdout: string) {
  const colo_distribution: Record<string, number> = {};
  const placement_colo_distribution: Record<string, number> = {};
  const isolateIds = new Set<string>();

  for (const line of stdout.split("\n")) {
    const coloMatch = line.match(/\[COLO_TRACKER\] colo:([a-zA-Z0-9-]+)/);
    if (coloMatch) {
      const colo = coloMatch[1];
      colo_distribution[colo] = (colo_distribution[colo] || 0) + 1;
    }

    const placementMatch = line.match(
      /\[PLACEMENT_TRACKER\] colo:([a-zA-Z0-9-]+)/,
    );
    if (placementMatch) {
      const placementColo = placementMatch[1];
      placement_colo_distribution[placementColo] =
        (placement_colo_distribution[placementColo] || 0) + 1;
    }

    const isolateMatch = line.match(/\[ISOLATE_TRACKER\] id:([a-zA-Z0-9-]+)/);
    if (isolateMatch) isolateIds.add(isolateMatch[1]);
  }

  return {
    colo_distribution,
    placement_colo_distribution,
    isolate_tracking: {
      isolate_count: isolateIds.size,
      isolate_ids: Array.from(isolateIds),
    },
  };
}

function parsePerLevelIsolates(
  stdout: string,
): Record<string, { isolate_count: number; isolate_ids: string[] }> {
  const perLevel: Record<string, Set<string>> = {};

  for (const line of stdout.split("\n")) {
    const match = line.match(
      /\[ISOLATE_TRACKER\] level:(\S+) id:([a-zA-Z0-9-]+)/,
    );
    if (match) {
      const [, level, id] = match;
      if (!perLevel[level]) perLevel[level] = new Set();
      perLevel[level].add(id);
    }
  }

  return Object.fromEntries(
    Object.entries(perLevel).map(([level, ids]) => [
      level,
      { isolate_count: ids.size, isolate_ids: Array.from(ids) },
    ]),
  );
}

async function getAuthTokens(): Promise<
  Array<{ token: string; agency: string }>
> {
  const results: Array<{ token: string; agency: string }> = [];
  for (let i = 1; i <= 100; i++) {
    const agency = `agency${i}`;
    const res = await fetch(`${targetUrls.node}/${agency}/api/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `user1@${agency}.com`,
        password: "user1234",
      }),
    });
    if (!res.ok) throw new Error(`Signin failed for ${agency}: ${res.status}`);
    const match = res.headers.get("set-cookie")?.match(/authToken=([^;]+)/);
    if (match) results.push({ token: match[1], agency });
  }
  return results;
}

async function fullReset(pattern: string): Promise<void> {
  let deployPromise: Promise<void> = Promise.resolve();

  if (pattern !== "node") {
    if (isLocal) {
      deployPromise = (async () => {
        console.log(`restarting worker: ${pattern}`);
        execSsh("127.0.0.1", `pkill -f "dev:${pattern}" || true`);
        spawn("pnpm", ["--filter", "worker", "run", `dev:${pattern}`], {
          stdio: "ignore",
          detached: true,
        }).unref();
        await sleep(2000);
      })();
    } else {
      deployPromise = (async () => {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            console.log(`deploying worker: ${pattern}`);
            await new Promise<void>((resolve, reject) => {
              const proc = spawn(
                "pnpm",
                ["--filter", "worker", "run", `deploy:${pattern}`],
                { stdio: "pipe" },
              );
              let stderr = "";
              proc.stderr?.on("data", (c: Buffer) => (stderr += c.toString()));
              proc.on("exit", (code) =>
                code === 0
                  ? resolve()
                  : reject(new Error(`exit ${code}\n${stderr}`)),
              );
            });
            return;
          } catch {
            await sleep(5000);
          }
        }
      })();
    }
  }

  console.log(`stop services`);
  execSsh(vpsIp, "docker stop node postgrest pgbouncer || true");
  execSsh(
    vpsIp,
    "truncate -s 0 $(docker inspect --format='{{.LogPath}}' psql-db pgbouncer postgrest node 2>/dev/null) || true",
  );

  console.log(`restart db`);
  execSsh(vpsIp, "docker restart psql-db");
  execSsh(
    vpsIp,
    `for i in $(seq 1 30); do docker exec psql-db pg_isready -U postgres -q && exit 0; sleep 1; done; exit 1`,
  );

  execRemoteSql("SELECT pg_stat_statements_reset();");
  execRemoteSql("TRUNCATE TABLE events RESTART IDENTITY;");

  console.log(`start services`);
  execSsh(vpsIp, "docker start pgbouncer postgrest node");
  execSsh(
    vpsIp,
    `for i in $(seq 1 30); do nc -z localhost 6432 && exit 0 || true; sleep 1; done; exit 1`,
  );
  execSsh(
    vpsIp,
    `for i in $(seq 1 30); do COUNT=$(docker exec psql-db psql -U postgres -d tenant_db -tA -c "SELECT count(*) FROM pg_stat_activity WHERE usename = 'agency_postgrest' AND state = 'idle';" 2>/dev/null || echo "0"); if [ "$COUNT" -gt 0 ]; then exit 0; fi; sleep 1; done; exit 1`,
  );
  execSsh(
    vpsIp,
    `for i in $(seq 1 30); do docker logs node 2>&1 | grep -q "Server running" && exit 0 || true; sleep 1; done; exit 1`,
  );

  if (isLocal) {
    await sleep(3000);
  }

  console.log(`reset done`);

  await deployPromise;
}

async function runRemote(
  region: string,
  pattern: string,
  suite: string,
  size: string,
  authTokens: Array<{ token: string; agency: string }>,
  runDir: string,
): Promise<void> {
  const ip = dropletIps[region];
  const summaryFile = `/tmp/k6-summary-${suite}.json`;

  let tunnel: ChildProcess | undefined;
  if (!isLocal) {
    tunnel = spawn("ssh", [
      ...sshArgs,
      "-N",
      "-L",
      "15432:127.0.0.1:5432",
      `root@${vpsIp}`,
    ]);
    await sleep(1500);
  }

  const pgClient = new Client({
    connectionString: isLocal
      ? `postgresql://postgres:${process.env.DB_PASSWORD}@127.0.0.1:5432/tenant_db`
      : `postgresql://postgres:${process.env.DB_PASSWORD}@127.0.0.1:15432/tenant_db`,
  });
  await pgClient.connect();

  const dbPattern = pattern.replace("-pop", "");
  let peakConnections = 0;

  const poller = setInterval(async () => {
    try {
      const res = await pgClient.query(
        `SELECT count(*) FROM pg_stat_activity WHERE usename = 'agency_${dbPattern}'`,
      );
      const n = parseInt(res.rows[0].count, 10) || 0;
      if (n > peakConnections) peakConnections = n;
    } catch {}
  }, 200);

  let remoteCmd: string;
  if (isLocal) {
    remoteCmd =
      `k6 run --quiet --address=localhost:0` +
      ` --env SUMMARY_FILE=${summaryFile}` +
      ` --env BASE_URL=${targetUrls[pattern]}` +
      ` --env REGION=${region}` +
      ` --env PATTERN=${pattern}` +
      ` --env PAYLOAD_SIZE=${size}` +
      ` --env AGENCY=agency1` +
      ` --env AUTH_TOKENS=${JSON.stringify(JSON.stringify(authTokens))}` +
      ` scripts/k6/${suite}.js 2>&1`;
  } else {
    remoteCmd =
      `k6 run --quiet --address=localhost:0` +
      ` --env SUMMARY_FILE=${summaryFile}` +
      ` --env BASE_URL=${targetUrls[pattern]}` +
      ` --env REGION=${region}` +
      ` --env PATTERN=${pattern}` +
      ` --env PAYLOAD_SIZE=${size}` +
      ` --env AGENCY=agency1` +
      ` --env AUTH_TOKENS=${JSON.stringify(JSON.stringify(authTokens))}` +
      ` /opt/geo-runner/${suite}.js 2>&1`;
  }
  console.log(`run k6 for ${size}-${pattern}-${suite}-${region}`);
  let proc: ChildProcess;
  if (isLocal) {
    proc = spawn("bash", ["-c", remoteCmd], {
      stdio: ["inherit", "pipe", "inherit"],
    });
  } else {
    proc = spawn("ssh", [...sshArgs, `root@${ip}`, remoteCmd], {
      stdio: ["inherit", "pipe", "inherit"],
    });
  }

  let k6Logs = "";
  proc.stdout?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    k6Logs += text;
    process.stdout.write(text);
  });

  await new Promise<void>((resolve, reject) => {
    proc.on("exit", (code) => {
      if (code !== 0 && code !== 99)
        return reject(new Error(`k6 exit ${code}`));
      resolve();
    });
  });

  clearInterval(poller);
  await sleep(3000);

  const idleRes = await pgClient.query(
    `SELECT count(*) FROM pg_stat_activity WHERE usename = 'agency_${dbPattern}' AND state = 'idle'`,
  );
  const idleAfterRun = parseInt(idleRes.rows[0].count, 10) || 0;

  await pgClient.end();

  if (tunnel) {
    tunnel.kill();
  }

  const summary = JSON.parse(sshRead(ip, summaryFile));

  summary.connection_metrics = {
    peak_connections: peakConnections,
    idle_after_run: idleAfterRun,
  };

  const routingData = parseRoutingLogs(k6Logs);

  if (Object.keys(routingData.colo_distribution).length > 0)
    summary.colo_distribution = routingData.colo_distribution;

  if (Object.keys(routingData.placement_colo_distribution).length > 0)
    summary.placement_colo_distribution =
      routingData.placement_colo_distribution;

  if (suite === "latency" || suite === "throughput") {
    if (routingData.isolate_tracking.isolate_count > 0)
      summary.isolate_tracking = routingData.isolate_tracking;
  } else {
    const perLevel = parsePerLevelIsolates(k6Logs);
    if (Object.keys(perLevel).length > 0) summary.isolate_per_level = perLevel;
  }

  mkdirSync(runDir, { recursive: true });
  writeFileSync(
    `${runDir}/${size}-${pattern}-${suite}-${region}.json`,
    JSON.stringify(
      { metadata: { size, pattern, suite, region }, data: summary },
      null,
      2,
    ),
  );
}

async function main(): Promise<void> {
  type Run = { size: string; suite: string; region: string; pattern: string };
  const iterations = 30;

  for (let iteration = 1; iteration <= iterations; iteration++) {
    const runs: Run[] = [];

     const payloads = ["1kb", "10kb"];
    const suitesA = ["concurrency", "burst"];
    const suitesB = ["latency", "throughput"];
    const regions = isLocal ? ["local"] : ["london", "new-york", "singapore"];
    const patternsA = ["pg", "pg-pool"];
    const patternsB = ["pg", "pgbouncer", "postgrest", "hyperdrive", "node"];
    const popPatternsB = [
      "pg-pop",
      "pgbouncer-pop",
      "postgrest-pop",
      "hyperdrive-pop",
    ];

    const regionA = isLocal ? "local" : "london";
    for (const suite of suitesA) {
      for (const pattern of patternsA) {
        runs.push({ size: "1kb", suite, region: regionA, pattern });
      }
    }

    for (const size of payloads) {
      for (const suite of suitesB) {
        for (const region of regions) {
          for (const pattern of patternsB) {
            runs.push({ size, suite, region, pattern });
          }
        }
      }
    }

    if (!isLocal) {
      for (const suite of suitesB) {
        for (const region of regions) {
          for (const pattern of popPatternsB) {
            runs.push({ size: "1kb", suite, region, pattern });
          }
        }
      }
    }

    shuffle(runs);

    const runDir = nextRunDir();
    const jwtTokens = await getAuthTokens();

    for (const run of runs) {
      await fullReset(run.pattern);
      await runRemote(
        run.region,
        run.pattern,
        run.suite,
        run.size,
        jwtTokens,
        runDir,
      );
    }
  }
}

main().catch((err) => {
  process.stderr.write(`${err}\n`);
  process.exit(1);
});
