import { JsonRpcProvider, formatEther } from "ethers";
import { writeFileSync } from "fs";
import * as readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';

const rl = readline.createInterface({ input, output });
const provider = new JsonRpcProvider("https://rpc.ankr.com/eth")

const getIntInput = async (question: string): Promise<string> => {
    return new Promise((resolve) => {
        rl.question(question, async (answer) => {
            while (isNaN(parseInt(answer))) {
                console.log("Invalid input, try again");
                answer = await getIntInput(question);

                if (!isNaN(parseInt(answer))) {
                    break;
                }
            }
            resolve(answer);
        });
    });
}

const getDateInput = async (question: string): Promise<string> => {
    return new Promise((resolve) => {
        rl.question(question, async (answer) => {
            const validateDateResponse = validateDate(answer);
            const validateBlockNumberResponse = await validateBlockNumber(answer);

            while (!validateDateResponse.success || !validateBlockNumberResponse.success) {
                console.log(!validateDateResponse.success ? `Invalid Date entered, try again` : `There is no valid block for the date provided: ${answer}`)
                answer = await getDateInput(question);

                const _validateDateResponse = validateDate(answer);
                const _validateBlockNumberResponse = await validateBlockNumber(answer);

                if (_validateDateResponse.success && _validateBlockNumberResponse.success) {
                    break;
                }
            }

            resolve(answer);
        });
    });
}

function validateDate(input: string) {
    const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;
    return { success: datePattern.test(input) }
}

const convertDateToTimestamp = (dateInput: string) => {
    const [day, month, year] = dateInput.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getTime() / 1000;
}

const validateBlockNumber = async (dateInput: string) => {
    try {
        const timestamp = convertDateToTimestamp(dateInput);

        // check if the date results into a valid block number
        let inputBlockNumber = await (await fetch(`https://coins.llama.fi/block/ethereum/${timestamp}`)).json();
        inputBlockNumber.height

        return { success: true, inputBlockNumber }

    } catch (error) {

        return { success: false }
    }
}


const main = async () => {
    // Get and clean inputs
    const lastTransactionDate = await getDateInput("Enter the date when the last transaction should be: ");
    const maxBalance = parseInt(await getIntInput("Enter the maximum amount of ETH the wallet should hold: "));
    const maxNoOfWallets = parseInt(await getIntInput("Enter the maximum number of wallets to be extracted: "));

    const timestamp = convertDateToTimestamp(lastTransactionDate);
    const blockNumber = await (await fetch(`https://coins.llama.fi/block/ethereum/${timestamp}`)).json();
    const blockHeight = blockNumber.height;

    console.log("\n\nExtracting wallets, following the creteria below:");
    console.log("Last transaction block: ", blockHeight);
    console.log("Max wallet balance: ", maxBalance);
    console.log("No of wallets to extract: ", maxNoOfWallets, "\n\n");

    /**
     * 1. Loop through blocks between start and end
     * 2. For each block, loop through transactions
     * 3. For each transaction:
     *      a. Get EOAs that are involved in the transaction
     *      b. Get their balance
     *      c. Filter balances to be within the range
     *      
     */

    const wallets: string[] = []
    let count = 0;

    for (let i = blockHeight; i > 0; i--) {
        const block = await provider.getBlock(i);

        if (block) {
            for (const transaction of block.transactions) {
                const transactionData = await provider.getTransaction(transaction);

                console.log(`Progress: ${count}/${maxNoOfWallets}  (${(count / maxNoOfWallets * 100).toFixed(2)} %)`);

                if (transactionData?.to || transactionData?.from) {
                    if (transactionData?.from) {
                        const fromCode = await provider.getCode(transactionData.from!);
                        if (fromCode === "0x" && !wallets.includes(transactionData.from!)) {
                            const fromBalance = parseFloat(formatEther(await provider.getBalance(transactionData.from!)))

                            if (fromBalance < maxBalance && !wallets.includes(transactionData.from!)) {
                                wallets.push(transactionData.from!);
                                count++;
                            }
                        }
                    }

                    if (transactionData?.to) {
                        const toCode = await provider.getCode(transactionData.to!);
                        if (toCode === "0x" && !wallets.includes(transactionData.to!)) {
                            const toBalance = transactionData.to ? parseFloat(formatEther(await provider.getBalance(transactionData.to!))) : 0;

                            if (toBalance < maxBalance && !wallets.includes(transactionData.to!)) {
                                wallets.push(transactionData.to!);
                                count++;
                            }
                        }
                    }
                }

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