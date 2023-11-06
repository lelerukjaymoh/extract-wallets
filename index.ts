import { JsonRpcProvider, formatEther } from "ethers";
import { writeFileSync } from "fs";

const main = async () => {
    // Get and clean inputs
    const highestBlockNo = 18511978;
    const maxBalance = 1; // eth
    const maxNoOfWallets = 2;
    /**
     * 1. Loop through blocks between start and end
     * 2. For each block, loop through transactions
     * 3. For each transaction:
     *      a. Get EOAs that are involved in the transaction
     *      b. Get their balance
     *      c. Filter balances to be within the range
     *      
     */

    const provider = new JsonRpcProvider("https://rpc.ankr.com/eth")
    const wallets: string[] = []

    for (let i = highestBlockNo; i > 0; i--) {
        console.log("Current block: ", i);
        const block = await provider.getBlock(i);

        if (block) {
            for (const transaction of block.transactions) {
                const transactionData = await provider.getTransaction(transaction);

                console.log("\n\nTransaction: ", transaction);

                if (transactionData?.to || transactionData?.from) {
                    if (transactionData?.from) {
                        const fromCode = await provider.getCode(transactionData.from!);
                        console.log("fromCode: ", fromCode.slice(0, 10));

                        if (fromCode === "0x" && !wallets.includes(transactionData.from!)) {
                            const fromBalance = parseFloat(formatEther(await provider.getBalance(transactionData.from!)))

                            if (fromBalance < maxBalance && !wallets.includes(transactionData.from!)) {
                                wallets.push(transactionData.from!);
                            }

                            console.log("from: ", transactionData.from, fromBalance);

                        }
                    }

                    if (transactionData?.to) {
                        const toCode = await provider.getCode(transactionData.to!);
                        console.log("toCode: ", toCode.slice(0, 10));

                        if (toCode === "0x" && !wallets.includes(transactionData.to!)) {
                            const toBalance = transactionData.to ? parseFloat(formatEther(await provider.getBalance(transactionData.to!))) : 0;

                            if (toBalance < maxBalance && !wallets.includes(transactionData.to!)) {
                                wallets.push(transactionData.to!);
                            }

                            console.log("to: ", transactionData.to, toBalance);

                        }
                    }
                }

                console.log("wallets: ", wallets);

                // Once the maximum number of wallets is reached, save data in file and exit
                if (wallets.length >= maxNoOfWallets) {
                    console.log("\n\nMax number of wallets reached");
                    console.log(wallets);

                    writeFileSync("./wallets.json", JSON.stringify(wallets, null, 2));

                    process.exit(0)
                }
            }
        }
    }
}

main()