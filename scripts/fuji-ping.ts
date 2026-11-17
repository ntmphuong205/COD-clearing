// First Fuji milestone: send one settlement message from a carrier L1 to the hub and time its arrival.
// Usage: MODE=fuji tsx fuji-ping.ts [A|B]     (also works with MODE=local while the mock relayer runs)
import { abi, clients, loadDeployment, sleep, orderKey, addr, ANVIL } from "./lib.ts";
import type { Hex } from "viem";

const mode = process.env.MODE ?? "fuji";
const d = loadDeployment(mode);
const which = (process.argv[2] ?? "A").toUpperCase() === "B" ? "carrierB" : "carrierA";
const c = d[which];
const key = (process.env.DEPLOYER_KEY ?? (mode === "local" ? ANVIL.admin : undefined)) as Hex | undefined;
if (!key) throw new Error("set DEPLOYER_KEY (the ledger admin)");

const src = clients(c, c.name, key);
const hub = clients(d.hubChain, "hub");
const me = addr(key);
const code = `PING-${Date.now()}`;
const k = orderKey(code);
const ledger = { address: c.ledger, abi: abi("DeliveryLedger") } as const;

// The admin acts as courier and seller of a 1,000 VND ping order (createOrders grants the courier role).
const tx = async (functionName: string, args: unknown[]) => {
  const hash = await src.wallet!.writeContract({ ...ledger, functionName, args } as never);
  await src.pub.waitForTransactionReceipt({ hash });
  return hash;
};
await tx("createOrders", [[{ orderKey: k, seller: me, codVnd: 1000n, shippingFeeVnd: 0n, codFeeVnd: 0n, returnFeeVnd: 0n, courier: me }]]);
await tx("markPickedUp", [k]);
const seq = (await src.pub.readContract({ ...ledger, functionName: "lastSeq" })) as bigint;
const t0 = Date.now();
const sentTx = await tx("markDelivered", [k]);
const seqSent = seq + 1n;
console.log(`${c.name}: sent seq ${seqSent} in ${sentTx}; waiting for the hub to record it…`);

const timeoutMs = Number(process.env.PING_TIMEOUT_S ?? 300) * 1000;
while (Date.now() - t0 < timeoutMs) {
  const done = await hub.pub.readContract({
    address: d.hubChain.hub, abi: abi("SettlementHub"), functionName: "processed", args: [BigInt(c.carrierId), seqSent],
  });
  if (done) {
    console.log(`ARRIVED after ${((Date.now() - t0) / 1000).toFixed(1)} s (seq ${seqSent}, order ${code})`);
    process.exit(0);
  }
  await sleep(1000);
}
console.error(`NOT arrived after ${timeoutMs / 1000} s. See the troubleshooting table in RUNBOOK.md (relayer running? TxAllowList? gas limit?).`);
process.exit(1);
