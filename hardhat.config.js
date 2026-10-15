import "@nomicfoundation/hardhat-ethers";
import "dotenv/config";

const pk = process.env.DEPLOYER_PRIVATE_KEY || "";

export default {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    qmsTestnet: {
      url: "https://rpc.testnet.qms.finance",
      chainId: 19480,
      accounts: /^0x[0-9a-fA-F]{64}$/.test(pk) ? [pk] : []
    }
  }
};
