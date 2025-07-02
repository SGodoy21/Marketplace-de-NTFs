const { ethers } = require("hardhat");

async function main() {
    // Obtener las primeras 10 cuentas de Hardhat
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    console.log(`Deployer address: ${deployer.address}`);

    // =======================================================================
    // 1. Desplegar el contrato MyToken (ERC20)
    // =======================================================================
    console.log("------------------------------------------");
    console.log("1. Deploying MyToken contract...");
    
    // Define la cantidad de tokens que se acuñarán inicialmente.
    // El deployer recibirá este suministro inicial.
    const initialSupply = ethers.parseUnits("10000000", 18); // 10 millones de tokens

    const MyToken = await ethers.getContractFactory("MyToken");
    const myToken = await MyToken.deploy(initialSupply);
    await myToken.waitForDeployment();
    
    const tokenAddress = await myToken.getAddress();
    console.log(`✅ MyToken contract deployed to address: ${tokenAddress}`);

    // **IMPORTANTE: Distribuir MTK a las primeras 10 cuentas de Hardhat**
    // La cuenta 0 (deployer) ya tiene el initialSupply.
    // Distribuimos a las cuentas 1 a 9.
    const tokensPerAccount = ethers.parseUnits("10000", 18); // 10,000 MTK por cuenta
    for (let i = 1; i < accounts.length && i < 10; i++) { // Empezar desde la cuenta 1
        await myToken.transfer(accounts[i].address, tokensPerAccount);
        console.log(`✅ ${ethers.formatUnits(tokensPerAccount, 18)} MTK transferred to Account ${i}: ${accounts[i].address}`);
    }
    console.log(`✅ Deployer (${deployer.address}) tiene el suministro inicial de ${ethers.formatUnits(initialSupply, 18)} MTK.`);


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
    // Orden de los parámetros del constructor del Marketplace: (address _nftAddress, address _tokenAddress)
    const marketplace = await Marketplace.deploy(nftAddress, tokenAddress); 
    await marketplace.waitForDeployment();

    const marketplaceAddress = await marketplace.getAddress();
    console.log(`✅ Marketplace contract deployed to address: ${marketplaceAddress}`);

    // =======================================================================
    // 4. Configurar el Marketplace y Mintear/Listar NFTs de ejemplo
    // =======================================================================
    console.log("------------------------------------------");
    console.log("4. Setting up Marketplace and minting/listing example NFTs...");

    // Asegurarse de que el contrato MyNFT sepa que el Marketplace es un operador autorizado
    const setApprovalForAllTx = await myNFT.connect(deployer).setApprovalForAll(marketplaceAddress, true);
    await setApprovalForAllTx.wait();
    console.log(`✅ MyNFT approved Marketplace as operator for deployer: ${deployer.address}`);

    // --- Funciones auxiliares para crear y pinear metadatos (simuladas aquí) ---
    // Usamos query parameters para que el frontend pueda parsear fácilmente
    async function createAndPinMetadata(id, name, description, imageUrl, rarity, creatorAddress) {
        const simulatedIpfsHash = `QmTEST${id}abcdefghijklmnopqrstuvwxyz0123456789ABCDEF`;
        return `ipfs://${simulatedIpfsHash}/metadata_${id}.json?id=${id}&name=${encodeURIComponent(name)}&description=${encodeURIComponent(description)}&image=${encodeURIComponent(imageUrl)}&rarity=${encodeURIComponent(rarity)}&creator=${encodeURIComponent(creatorAddress)}`;
    }

    // Mintear y listar NFT ID 0 (del deployer)
    const nft0MetadataUri = await createAndPinMetadata(
        0, 
        "CryptoPanda #0", 
        "Un panda digital coleccionable.", 
        "https://placehold.co/400x400/007bff/ffffff?text=Panda+0", // Placeholder azul
        "Común",
        deployer.address
    );
    await myNFT.connect(deployer).safeMint(deployer.address, nft0MetadataUri);
    await myNFT.connect(deployer).approve(marketplaceAddress, 0);
    await marketplace.connect(deployer).listItem(0, ethers.parseUnits("100", 18));
    console.log(`✅ Minted and Listed NFT ID 0 (by deployer).`);

    // Mintear y listar NFT ID 1 (del deployer)
    const nft1MetadataUri = await createAndPinMetadata(
        1, 
        "Mona Lisa Digital #1", 
        "La Mona Lisa reinventada en el mundo digital.", 
        "https://placehold.co/400x400/28a745/ffffff?text=Mona+1", // Placeholder verde
        "Raro",
        deployer.address
    );
    await myNFT.connect(deployer).safeMint(deployer.address, nft1MetadataUri);
    await myNFT.connect(deployer).approve(marketplaceAddress, 1);
    await marketplace.connect(deployer).listItem(1, ethers.parseUnits("150", 18));
    console.log(`✅ Minted and Listed NFT ID 1 (by deployer).`);

    // Mintear NFT ID 2 (para la cuenta 1, no listado inicialmente)
    const nft2MetadataUri = await createAndPinMetadata(
        2, 
        "Pixel Art Dragon #2", 
        "Un majestuoso dragón en pixel art.", 
        "https://placehold.co/400x400/dc3545/ffffff?text=Dragon+2", // Placeholder rojo
        "Épico",
        accounts[1].address
    );
    await myNFT.connect(deployer).safeMint(accounts[1].address, nft2MetadataUri); // Deployer mintea para accounts[1]
    console.log(`✅ Minted NFT with ID 2 to Account 1: ${accounts[1].address} (not listed).`);


    console.log("------------------------------------------");
    console.log("¡Despliegue y configuración completados!");
    console.log("Por favor, actualiza las direcciones de los contratos en frontend/app.js:");
    console.log(`const MY_TOKEN_ADDRESS = "${tokenAddress}";`);
    console.log(`const MY_NFT_ADDRESS = "${nftAddress}";`);
    console.log(`const MARKETPLACE_ADDRESS = "${marketplaceAddress}";`);
    console.log("------------------------------------------");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
