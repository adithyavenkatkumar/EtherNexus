import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import solc from "solc";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deploy() {
    console.log("🚀 Starting deployment process...");

    // 1. Compile the contract
    const contractPath = path.resolve(__dirname, "../../contract/PaymentSystem.sol");
    console.log(`📖 Reading contract from: ${contractPath}`);

    const source = fs.readFileSync(contractPath, "utf8");

    const input = {
        language: "Solidity",
        sources: {
            "PaymentSystem.sol": {
                content: source,
            },
        },
        settings: {
            outputSelection: {
                "*": {
                    "*": ["abi", "evm.bytecode"],
                },
            },
        },
    };

    console.log("🔨 Compiling contract...");
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
        let hasError = false;
        output.errors.forEach((err) => {
            if (err.severity === 'error') {
                console.error(`❌ Compilation Error: ${err.message}`);
                hasError = true;
            } else {
                console.warn(`⚠️ Compilation Warning: ${err.message}`);
            }
        });
        if (hasError) process.exit(1);
    }

    const compiledContract = output.contracts["PaymentSystem.sol"]["PaymentSystem"];
    const abi = compiledContract.abi;
    const bytecode = compiledContract.evm.bytecode.object;

    console.log("✅ Compilation successful!");

    // 2. Connect to Sepolia
    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    const privateKey = process.env.SEPOLIA_PRIVATE_KEY;

    if (!rpcUrl || !privateKey) {
        console.error("❌ Error: Missing SEPOLIA_RPC_URL or SEPOLIA_PRIVATE_KEY in .env");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(`🔌 Connected to Sepolia with wallet: ${wallet.address}`);

    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} ETH`);

    // 3. Deploy
    console.log("📤 Deploying contract...");
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);

    try {
        const contract = await factory.deploy();
        console.log(`⏳ Waiting for transaction confirmation... (Tx: ${contract.deploymentTransaction().hash})`);

        await contract.waitForDeployment();

        const address = await contract.getAddress();

        // Write to file
        fs.writeFileSync(path.resolve(__dirname, '../deployed_address.txt'), address);

        console.log(`\n${'='.repeat(60)}`);
        console.log(`🎉 CONTRACT DEPLOYED SUCCESSFULLY!`);
        console.log(`${'='.repeat(60)}`);
        console.log(`Address: ${address}`);
        console.log(`${'='.repeat(60)}\n`);

        return address;
    } catch (error) {
        console.error("❌ Deployment failed:", error);
    }
}

deploy();
