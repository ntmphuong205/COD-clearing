// One command: start 3 anvils, deploy, seed, run the mock relayer. Ctrl-C stops everything.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { ROOT, sleep } from "./lib.ts";

const env = { ...process.env, PATH: `${process.env.HOME}/.foundry/bin:${process.env.PATH}` };
const TSX = resolve(ROOT, "scripts/node_modules/.bin/tsx");
const kids: ChildProcess[] = [];
const stop = () => { kids.forEach((k) => k.kill()); process.exit(0); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);

for (const [port, chainId] of [[8545, 31337], [8546, 20261], [8547, 20262]]) {
  kids.push(spawn("anvil", ["--port", String(port), "--chain-id", String(chainId), "--silent"], { env, stdio: "inherit" }));
}
for (let i = 0; i < 40; i++) {
  const ok = [8545, 8546, 8547].every((p) =>
    spawnSync("cast", ["chain-id", "--rpc-url", `http://127.0.0.1:${p}`], { env }).status === 0);
  if (ok) break;
  await sleep(250);
}
const run = (cmd: string, args: string[], cwd = ROOT) => {
  const r = spawnSync(cmd, args, { cwd, env: { ...env, MODE: "local" }, stdio: "inherit" });
  if (r.status !== 0) { console.error(`${cmd} ${args.join(" ")} failed`); stop(); }
};
run("forge", ["script", "script/DeployLocal.s.sol", "--broadcast", "--silent"], resolve(ROOT, "contracts"));
run(TSX, ["scripts/seed.ts"]);
kids.push(spawn(TSX, ["scripts/mock-relayer.ts"], { cwd: ROOT, env, stdio: "inherit" }));
console.log("\nLOCAL demo ready. hub :8545  carrierA :8546  carrierB :8547   (Ctrl-C to stop)\n");
await new Promise(() => {});
