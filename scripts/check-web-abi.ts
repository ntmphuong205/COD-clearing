// Smoke test: the hand-written ABIs the web app uses must work against the deployed contracts.
import { parseAbiItem } from "viem";
import { ANVIL, addr, clients, loadDeployment } from "./lib.ts";
import * as webAbi from "../web/src/lib/abi.ts";
// web/ is CommonJS to tsx, so named exports may sit under .default
const { erc20Abi, escrowAbi, hubAbi, ledgerAbi } = ((webAbi as any).default ?? webAbi) as typeof webAbi;

const d = loadDeployment("local");
const seller = addr(ANVIL.seller), courier = addr(ANVIL.courier);
const hub = clients(d.hubChain, "hub").pub, a = clients(d.carrierA, "A").pub;
const h = d.hubChain.hub;
const r = (functionName: string, args: unknown[] = []) => hub.readContract({ address: h, abi: hubAbi, functionName, args } as never);
console.log("epoch", await r("currentEpoch"), "window", await r("disputeWindow"), "rate", await r("vndPerUsdc"));
console.log("carriers", ((await r("getCarriers")) as unknown[]).length, "balances", await r("balancesOf", [seller]));
console.log("payouts", await r("payoutsOf", [1n, seller]), "epochInfo", await r("epochInfo", [1n]), "processed", await r("processed", [1n, 1n]));
const keys = (await a.readContract({ address: d.carrierA.ledger, abi: ledgerAbi, functionName: "ordersOfCourier", args: [courier] })) as `0x${string}`[];
console.log("orders", keys.length, await a.readContract({ address: d.carrierA.ledger, abi: ledgerAbi, functionName: "getOrder", args: [keys[0]] }));
for (const fn of ["balance", "committed", "available"]) console.log(fn, await hub.readContract({ address: d.carrierA.escrow, abi: escrowAbi, functionName: fn } as never));
console.log("usdc", await hub.readContract({ address: d.hubChain.usdc, abi: erc20Abi, functionName: "balanceOf", args: [seller] }));
console.log("logs", (await hub.getLogs({ address: h, event: parseAbiItem("event SettlementRecorded(uint256 indexed carrierId, address indexed seller, uint64 seq, bytes32 orderKey, uint8 kind, int256 deltaVnd, int256 newBalance)"), args: { seller }, fromBlock: 0n })).length);
