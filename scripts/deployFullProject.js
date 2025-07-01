const { ethers } = require("hardhat");

async function main() {
    // =======================================================================
    // 1. Desplegar el contrato MyToken (ERC20)
    // =======================================================================
    console.log("------------------------------------------");
    console.log("1. Deploying MyToken contract...");
    
    // Define la cantidad de tokens que se acuñarán inicialmente.
    const initialSupply = ethers.parseUnits("1000000", 18); // 1 millón de tokens

    const MyToken = await ethers.getContractFactory("MyToken");
    // Desplegamos MyToken con la cantidad inicial (asumiendo que tu constructor MyToken.sol espera esto)
    const myToken = await MyToken.deploy(initialSupply);
    await myToken.waitForDeployment();
    
    const tokenAddress = await myToken.getAddress();
    console.log(`✅ MyToken contract deployed to address: ${tokenAddress}`);

    // =======================================================================
    // 2. Desplegar el contrato MyNFT (ERC721)
    // =======================================================================
    console.log("------------------------------------------");
    console.log("2. Deploying MyNFT contract...");

    const MyNFT = await ethers.getContractFactory("MyNFT");
    const myNFT = await MyNFT.deploy();
    await myNFT.waitForDeployment();

    const nftAddress = await myNFT.getAddress();
    console.log(`✅ MyNFT contract deployed to address: ${nftAddress}`);

    // =======================================================================
    // 3. Desplegar el contrato Marketplace
    // =======================================================================
    console.log("------------------------------------------");
    console.log("3. Deploying Marketplace contract...");

    const Marketplace = await ethers.getContractFactory("Marketplace");
    const marketplace = await Marketplace.deploy(nftAddress, tokenAddress);
    await marketplace.waitForDeployment();

    const marketplaceAddress = await marketplace.getAddress();
    console.log(`✅ Marketplace contract deployed to address: ${marketplaceAddress}`);

    console.log("------------------------------------------");
    console.log("Deployment finished successfully!");
    console.log(" ");
    console.log("📋 Contract Addresses:");
    console.log(`    - MyToken:     ${tokenAddress}`);
    console.log(`    - MyNFT:       ${nftAddress}`);
    console.log(`    - Marketplace: ${marketplaceAddress}`);
    console.log(" ");

    // =======================================================================
    // 4. Mintear y Listar NFTs de Prueba
    // =======================================================================
    const [deployer] = await ethers.getSigners();
    console.log("------------------------------------------");
    console.log("4. Minting and Listing Test NFTs...");

    // NFT ID 0
    const NFT_URI_0 = "ipfs://QmYxXgH1j2K3L4M5N6O7P8Q9R0S1T2U3V4W5X6Y7Z8a9b0c1d2e3f4_ID0";
    const mintTx0 = await myNFT.safeMint(deployer.address, NFT_URI_0);
    await mintTx0.wait();
    console.log(`✅ Minted NFT with ID 0 to deployer: ${deployer.address}`);

    const approveTx0 = await myNFT.approve(marketplaceAddress, 0);
    await approveTx0.wait();
    console.log(`✅ Approved Marketplace to manage NFT ID 0`);

    const LISTING_PRICE_0 = ethers.parseUnits("100", 18); // 100 MTK
    const listTx0 = await marketplace.listItem(0, LISTING_PRICE_0);
    await listTx0.wait();
    console.log(`✅ Listed NFT ID 0 for 100 MTK`);


    // NFT ID 1
    const NFT_URI_1 = "ipfs://QmYxXgH1j2K3L4M5N6O7P8Q9R0S1T2U3V4W5X6Y7Z8a9b0c1d2e3f4_ID1";
    const mintTx1 = await myNFT.safeMint(deployer.address, NFT_URI_1);
    await mintTx1.wait();
    console.log(`✅ Minted NFT with ID 1 to deployer: ${deployer.address}`);

    const approveTx1 = await myNFT.approve(marketplaceAddress, 1);
    await approveTx1.wait();
    console.log(`✅ Approved Marketplace to manage NFT ID 1`);

    const LISTING_PRICE_1 = ethers.parseUnits("150", 18); // 150 MTK
    const listTx1 = await marketplace.listItem(1, LISTING_PRICE_1);
    await listTx1.wait();
    console.log(`✅ Listed NFT ID 1 for 150 MTK`);


    // NFT ID 2
    const NFT_URI_2 = "ipfs://QmYxXgH1j2K3L4M5N6O7P8Q9R0S1T2U3V4W5X6Y7Z8a9b0c1d2e3f4_ID2";
    const mintTx2 = await myNFT.safeMint(deployer.address, NFT_URI_2);
    await mintTx2.wait();
    console.log(`✅ Minted NFT with ID 2 to deployer: ${deployer.address}`);

    const approveTx2 = await myNFT.approve(marketplaceAddress, 2);
    await approveTx2.wait();
    console.log(`✅ Approved Marketplace to manage NFT ID 2`);

    const LISTING_PRICE_2 = ethers.parseUnits("200", 18); // 200 MTK
    const listTx2 = await marketplace.listItem(2, LISTING_PRICE_2);
    await listTx2.wait();
    console.log(`✅ Listed NFT ID 2 for 200 MTK`);

    console.log("------------------------------------------");
    console.log("Deployment and initial setup complete.");
}

// Se recomienda usar este patrón para manejar errores
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
