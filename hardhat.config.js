import "@nomicfoundation/hardhat-ethers";
import "dotenv/config";

const pk = (process.env.DEPLOYER_PRIVATE_KEY || "").trim();
const validPrivateKey = /^0x[a-fA-F0-9]{64}$/.test(pk);

export default {
  solidity: {
    version: "0.8.24",
    settings: {}
  },
  networks: {
    qmsTestnet: {
      url: process.env.QMS_RPC_URL || "https://rpc.testnet.qms.finance",
      chainId: 19480,
      accounts: validPrivateKey ? [pk] : []
    }
  }
};