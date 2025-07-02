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

    // NOTA: Se han eliminado los NFTs de prueba de este script.
    // Ahora deberás mintear NFTs usando la interfaz de usuario de tu dApp.
    console.log("------------------------------------------");
    console.log("No test NFTs were minted or listed by this script.");
    console.log("Please use the dApp UI to mint and list your NFTs.");
}

// Se recomienda usar este patrón para manejar errores
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
