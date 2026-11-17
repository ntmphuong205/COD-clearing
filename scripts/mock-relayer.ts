// LOCAL only: watches MockMessageSent on each carrier chain and delivers to the hub chain's mock messenger.
import { ANVIL, abi, clients, loadDeployment, sleep } from "./lib.ts";
import { parseAbiItem } from "viem";

const d = loadDeployment("local");
const messengerAbi = abi("MockTeleporterMessenger");
const hubC = clients(d.hubChain, "hub", ANVIL.relayer);
const event = parseAbiItem(
  "event MockMessageSent(bytes32 indexed destinationBlockchainID, address indexed destinationAddress, address sender, bytes message)",
);

// One wallet sends all deliveries, so serialize them to avoid nonce races between the watchers.
let queue: Promise<void> = Promise.resolve();
const enqueue = (fn: () => Promise<void>) => (queue = queue.then(fn, fn));

async function watch(k: "carrierA" | "carrierB") {
  const c = d[k];
  const { pub } = clients(c, c.name);
  let from = 0n;
  for (;;) {
    try {
      const head = await pub.getBlockNumber();
      if (head >= from) {
        const logs = await pub.getLogs({ address: c.messenger, event, fromBlock: from, toBlock: head });
        for (const log of logs) {
          const { sender, message, destinationAddress } = log.args;
          await enqueue(async () => {
            for (let attempt = 1; attempt <= 5; attempt++) {
              try {
                const hash = await hubC.wallet!.writeContract({
                  address: d.hubChain.messenger, abi: messengerAbi, functionName: "deliver",
                  args: [c.blockchainId, sender!, destinationAddress!, message!],
                });
                const r = await hubC.pub.waitForTransactionReceipt({ hash });
                console.log(`[relayer] ${c.name} block ${log.blockNumber} -> hub ${r.status} ${hash}`);
                return;
              } catch (e) {
                console.error(`[relayer] ${c.name} deliver attempt ${attempt} failed:`, (e as Error).message.split("\n")[0]);
                await sleep(500);
              }
            }
          });
        }
        from = head + 1n;
      }
    } catch (e) {
      console.error(`[relayer] ${c.name} poll error:`, (e as Error).message.split("\n")[0]);
    }
    await sleep(500);
  }
}
console.log("[relayer] started");
watch("carrierA");
watch("carrierB");
