// Seeds 18 demo orders (9 per carrier) for one demo seller. Order codes are fake;
// only their keccak hash goes on-chain. Orders are created and picked up so the courier
// can tap Delivered / Returned straight away.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ANVIL, ROOT, abi, addr, clients, loadDeployment, orderKey, type Deployment } from "./lib.ts";

const mode = process.env.MODE ?? "local";
const d = loadDeployment(mode);
const local = mode === "local";
const adminKey = (process.env.DEPLOYER_KEY ?? (local ? ANVIL.admin : undefined)) as `0x${string}` | undefined;
const courierKey = (process.env.COURIER_KEY ?? (local ? ANVIL.courier : undefined)) as `0x${string}` | undefined;
const seller = (process.env.SELLER_ADDRESS ?? (local ? addr(ANVIL.seller) : undefined)) as `0x${string}` | undefined;
const courier = (process.env.COURIER_ADDRESS ?? (courierKey ? addr(courierKey) : undefined)) as `0x${string}` | undefined;
if (!adminKey || !seller || !courier) throw new Error("set DEPLOYER_KEY, SELLER_ADDRESS and COURIER_ADDRESS (or COURIER_KEY)");

const ledgerAbi = abi("DeliveryLedger");
const PREFIX = { carrierA: "GHA", carrierB: "GHB" } as const;
const RETURNED_PER_CARRIER = [3, 8]; // indexes (0-based) that the demo script returns

const out: Record<string, unknown[]> = {};
for (const k of ["carrierA", "carrierB"] as const) {
  const c = d[k];
  const { pub, wallet } = clients(c, c.name, adminKey);
  const { wallet: courierWallet } = clients(c, c.name, courierKey);
  // Without COURIER_KEY the courier taps "Picked up" in the app instead.
  const inputs = Array.from({ length: 9 }, (_, i) => {
    const code = `${PREFIX[k]}-${String(i + 1).padStart(4, "0")}`;
    const cod = BigInt((3 + ((i * 7) % 9)) * 100_000); // 300k..1.1M VND
    return {
      code,
      key: orderKey(code),
      willReturn: RETURNED_PER_CARRIER.includes(i),
      input: {
        orderKey: orderKey(code), seller, codVnd: cod,
        shippingFeeVnd: 25_000n, codFeeVnd: cod / 100n, returnFeeVnd: 15_000n, courier,
      },
    };
  });
  let h = await wallet!.writeContract({
    address: c.ledger, abi: ledgerAbi, functionName: "createOrders", args: [inputs.map((x) => x.input)],
  });
  await pub.waitForTransactionReceipt({ hash: h });
  if (courierWallet) {
    for (const o of inputs) {
      h = await courierWallet.writeContract({
        address: c.ledger, abi: ledgerAbi, functionName: "markPickedUp", args: [o.key],
      });
    }
    await pub.waitForTransactionReceipt({ hash: h });
  }
  out[k] = inputs.map((o) => ({ code: o.code, orderKey: o.key, willReturn: o.willReturn }));
  console.log(`${c.name}: seeded ${inputs.length} orders for seller ${seller}, courier ${courier}`);
}
writeFileSync(resolve(ROOT, `deployments/seed-${mode}.json`), JSON.stringify({ seller, courier, ...out }, null, 2));
