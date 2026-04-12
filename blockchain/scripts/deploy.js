const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Starting deployment to Sepolia...");

    const [deployer] = await hre.ethers.getSigners();
    console.log("🔌 Deploying with wallet:", deployer.address);

    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("💰 Wallet balance:", hre.ethers.formatEther(balance), "ETH");

    const PaymentSystem = await hre.ethers.getContractFactory("PaymentSystem");
    console.log("📤 Deploying PaymentSystem...");

    const contract = await PaymentSystem.deploy();
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log("\n" + "=".repeat(40));
    console.log("🎉 CONTRACT DEPLOYED SUCCESSFULLY!");
    console.log("Address:", address);
    console.log("=".repeat(40) + "\n");

    // Save address to local files for frontend interaction
    const addressPath = path.join(__dirname, "../../frontend/deployed_address.txt");
    fs.writeFileSync(addressPath, address);
    console.log("📝 Saved address to:", addressPath);

    // Automatic verification on Etherscan
    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        console.log("🛡️ Waiting for block confirmations before verification...");

        // Wait for 5 block confirmations to ensure Etherscan has indexed the contract
        await contract.deploymentTransaction().wait(5);

        console.log("🔍 Verifying contract on Etherscan...");
        try {
            await hre.run("verify:verify", {
                address: address,
                constructorArguments: [],
            });
            console.log("✅ Contract verified successfully!");
        } catch (error) {
            if (error.message.toLowerCase().includes("already verified")) {
                console.log("ℹ️ Contract already verified.");
            } else {
                console.error("❌ Verification failed:", error);
            }
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
