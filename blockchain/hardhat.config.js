require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../frontend/.env" });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.19",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL || "",
            accounts: process.env.SEPOLIA_PRIVATE_KEY !== undefined ? [process.env.SEPOLIA_PRIVATE_KEY] : [],
        },
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY || "",
    },
    paths: {
        contracts: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts"
    }
};
