import fs from "node:fs";
import path from "node:path";
import hre from "hardhat";

const { ethers, network } = hre;

const TARGET_CHAIN_ID = 19480n;

const QWAP_ROUTER = "0x93AFF45f28e5DF1b55f5AEFEfB807De843b12619";
const QWAP_FACTORY = "0x93AFD9aC50822F82c7C4f2Ec8Ec2463b086Fb878";
const QWAP_WQMS = "0x9AA510295aC664A3d5A3182a3eFe959DE2B12c34";

const OUTPUT_FILE = path.resolve(
  process.cwd(),
  "frontend/deployments/qmswap-limit-order-v3.json"
);

const PUBLIC_OUTPUT_FILE = path.resolve(
  process.cwd(),
  "frontend/public/deployments/qmswap-limit-order-v3.json"
);

const EXECUTE = process.env.QMS_LIMIT_ORDER_V3_EXECUTE === "1" || process.argv.includes("--execute");

async function main() {
  console.log("\n========== QWAP LIMIT ORDER V3 PREFLIGHT ==========");

  if (network.name !== "qmsTestnet") {
    throw new Error(`Wrong Hardhat network: ${network.name}`);
  }

  const provider = ethers.provider;
  const chain = await provider.getNetwork();

  if (chain.chainId !== TARGET_CHAIN_ID) {
    throw new Error(`Wrong chain ID: ${chain.chainId}`);
  }

  if (fs.existsSync(OUTPUT_FILE)) {
    throw new Error("V3 deployment config already exists. Refusing to overwrite.");
  }

  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("No deployment signer.");

  const deployer = await signer.getAddress();
  const balance = await provider.getBalance(deployer);

  const routerCode = await provider.getCode(QWAP_ROUTER);
  const factoryCode = await provider.getCode(QWAP_FACTORY);
  const wqmsCode = await provider.getCode(QWAP_WQMS);

  if (routerCode === "0x") throw new Error("QWAP Router has no bytecode.");
  if (factoryCode === "0x") throw new Error("QWAP Factory has no bytecode.");
  if (wqmsCode === "0x") throw new Error("QWAP WQMS has no bytecode.");

  const router = new ethers.Contract(
    QWAP_ROUTER,
    [
      "function factory() view returns(address)",
      "function WQMS() view returns(address)",
      "function getAmountsOut(uint256,address[]) view returns(uint256[])"
    ],
    provider
  );

  const [actualFactory, actualWqms] = await Promise.all([
    router.factory(),
    router.WQMS()
  ]);

  if (actualFactory.toLowerCase() !== QWAP_FACTORY.toLowerCase()) {
    throw new Error("QWAP Router/Factory mismatch.");
  }

  if (actualWqms.toLowerCase() !== QWAP_WQMS.toLowerCase()) {
    throw new Error("QWAP Router/WQMS mismatch.");
  }

  console.log("Chain ID:", chain.chainId.toString());
  console.log("Deployer:", deployer);
  console.log("QMS balance:", ethers.formatEther(balance));
  console.log("QWAP Router:", QWAP_ROUTER);
  console.log("QWAP Factory:", actualFactory);
  console.log("QWAP WQMS:", actualWqms);

  const Factory = await ethers.getContractFactory(
    "QMSwapLimitOrderBookV3",
    signer
  );

  const request = await Factory.getDeployTransaction(QWAP_ROUTER);

  const estimatedGas = await provider.estimateGas({
    from: deployer,
    data: request.data,
    value: request.value ?? 0n
  });

  const feeData = await provider.getFeeData();
  const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;

  if (!feePerGas || feePerGas <= 0n) {
    throw new Error("Could not estimate deployment gas price.");
  }

  const estimatedCost = estimatedGas * feePerGas;
  const required = estimatedCost * 150n / 100n;

  console.log("Estimated gas:", estimatedGas.toString());
  console.log("Estimated deployment cost:", ethers.formatEther(estimatedCost), "QMS");
  console.log("Required with 50% margin:", ethers.formatEther(required), "QMS");

  if (balance < required) {
    throw new Error("Insufficient QMS for deployment.");
  }

  if (!EXECUTE) {
    console.log("\nPREFLIGHT ONLY. No transaction was sent.");
    console.log("After reviewing and testing, use --execute to deploy.");
    return;
  }

  console.log("\nDeploying QMSwapLimitOrderBookV3...");
  const book = await Factory.deploy(QWAP_ROUTER);

  const tx = book.deploymentTransaction();
  if (!tx) throw new Error("Deployment transaction missing.");

  console.log("Transaction:", tx.hash);

  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error("V3 deployment failed.");
  }

  const address = await book.getAddress();

  if (await provider.getCode(address) === "0x") {
    throw new Error("Deployed contract has no bytecode.");
  }

  const [deployedRouter, deployedWqms] = await Promise.all([
    book.router(),
    book.wrappedNative()
  ]);

  if (deployedRouter.toLowerCase() !== QWAP_ROUTER.toLowerCase()) {
    throw new Error("Post-deployment Router mismatch.");
  }

  if (deployedWqms.toLowerCase() !== QWAP_WQMS.toLowerCase()) {
    throw new Error("Post-deployment WQMS mismatch.");
  }

  const record = {
    version: "qwap-limit-order-v3",
    contractName: "QMSwapLimitOrderBookV3",
    chainId: Number(TARGET_CHAIN_ID),
    address,
    router: deployedRouter,
    factory: QWAP_FACTORY,
    wrappedNative: deployedWqms,
    deployer,
    deploymentBlock: receipt.blockNumber,
    transactionHash: receipt.hash,
    deployedAt: new Date().toISOString()
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

  const temporaryFile = `${OUTPUT_FILE}.tmp`;
  fs.writeFileSync(
    temporaryFile,
    JSON.stringify(record, null, 2) + "\n",
    { flag: "wx" }
  );
  fs.renameSync(temporaryFile, OUTPUT_FILE);

fs.mkdirSync(path.dirname(PUBLIC_OUTPUT_FILE), { recursive: true });
const publicTemporaryFile = `${PUBLIC_OUTPUT_FILE}.tmp`;
fs.writeFileSync(
  publicTemporaryFile,
  JSON.stringify(record, null, 2) + "\n",
  { flag: "w" }
);
fs.renameSync(publicTemporaryFile, PUBLIC_OUTPUT_FILE);

  console.log("\nDEPLOYMENT SUCCESS");
  console.log("Contract:", address);
  console.log("Transaction:", receipt.hash);
  console.log("Config:", OUTPUT_FILE);
}

main().catch(error => {
  console.error("\nLIMIT ORDER V3 FAILED:");
  console.error(error?.shortMessage || error?.message || error);
  process.exitCode = 1;
});