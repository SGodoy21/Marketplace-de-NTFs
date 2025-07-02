// Direcciones de los contratos desplegados
const MY_TOKEN_ADDRESS = "0x67d269191c92Caf3cD7723F116c85e6E9bf55933"; 
const MY_NFT_ADDRESS = "0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E";   
const MARKETPLACE_ADDRESS = "0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690"; 
const LISTING_PRICE_DEFAULT = "100"; // Precio por defecto para listar, en MTK (100 MTK)

// ABIs de los contratos (se cargan desde los archivos JSON)
let MyTokenABI;
let MyNFTABI;
let MarketplaceABI;

// Instancias de Ethers.js (serán re-inicializadas en cada cambio de cuenta)
let provider;
let signer;
let currentAccount = null; // Mantener currentAccount para claridad

let myTokenContract;
let myNFTContract;
let marketplaceContract;

// Objeto para almacenar temporalmente los precios de minteo por tokenId (no persistente en recargas completas)
const mintedNftPrices = {};

// Elementos del DOM (Declarados aquí, pero se les asignará el valor dentro de DOMContentLoaded)
let connectButton;
let connectStatus;
let accountAddress;
let mtkBalanceSpan;
let logList;
let marketplaceContainer;
let marketplaceGrid; // Added for marketplace items

let mintNftSection; // La sección completa de minteo
let mintFormContainer; // El div que contiene el formulario de minteo
let mintForm; // El formulario en sí
let nftNameInput; // Input para el nombre del NFT
let nftDescriptionInput; // Nuevo input para la descripción
let nftImageInput; // Nuevo input para la imagen
let nftPriceInput; // Input para el precio del NFT
let toggleMintFormButton; // Botón para abrir/cerrar el formulario
let createNftButton; // Botón "Crear NFT" dentro del formulario
let cancelMintButton; // Botón "Cancelar" dentro del formulario

let userNftsCollectionSection; // La sección completa de la colección del usuario
let userNftsGrid; // La cuadrícula donde se muestran los NFTs del usuario
let userNftsCountSpan; // El span que muestra el conteo de NFTs del usuario

let addNetworkButton;
let loadMarketplaceButton;
let listAllUserNftsButton;

// Banderas para prevenir llamadas duplicadas y re-entradas
let isUserNFTsLoading = false;
let isMarketplaceLoading = false;


// Función para añadir logs a la interfaz
function addLog(message, type = '') {
    if (!logList) {
        console.error("LogList not found, cannot add log:", message);
        return;
    }
    const li = document.createElement('li');
    li.textContent = message;
    if (type) li.classList.add(type);
    logList.prepend(li); // Añadir al principio para ver los más recientes
    // Limitar el número de logs para evitar desbordamiento
    if (logList.children.length > 50) {
        logList.removeChild(logList.lastChild);
    }
}

// ---------- Cargar ABIs (archivos JSON en el mismo folder)
async function loadABIs() {
    try {
        const [tokenRes, nftRes, marketplaceRes] = await Promise.all([
            fetch('abi/MyToken.json'), // Assuming ABIs are in an 'abi' folder
            fetch('abi/MyNFT.json'),
            fetch('abi/Marketplace.json'),
        ]);

        MyTokenABI = await tokenRes.json();
        MyNFTABI = await nftRes.json();
        MarketplaceABI = await marketplaceRes.json();

        addLog("✅ ABIs cargados correctamente.", 'success');
    } catch (e) {
        addLog("❌ Error cargando ABIs: " + e.message, 'error');
        console.error(e);
    }
}

// ---------- Inicializar contratos con el signer
function initializeContracts() {
    console.log("DEBUG: initializeContracts: Intentando inicializar contratos.");
    if (!provider) {
        addLog("❌ No hay proveedor para inicializar contratos.", 'error');
        console.error("DEBUG: initializeContracts: Provider is null.");
        return;
    }
    if (!signer) {
        addLog("❌ No hay firmante para inicializar contratos.", 'error');
        console.error("DEBUG: initializeContracts: Signer is null.");
        return;
    }

    // Inicializar instancias de contratos
    myTokenContract = new ethers.Contract(MY_TOKEN_ADDRESS, MyTokenABI.abi, signer);
    myNFTContract = new ethers.Contract(MY_NFT_ADDRESS, MyNFTABI.abi, signer);
    marketplaceContract = new ethers.Contract(MARKETPLACE_ADDRESS, MarketplaceABI.abi, signer);

    addLog("✅ Contratos inicializados.", 'success');

    // Eliminar todos los listeners anteriores para evitar duplicados al re-inicializar
    // Esto es crucial para evitar que los eventos se disparen múltiples veces.
    if (marketplaceContract) {
        marketplaceContract.removeAllListeners();
    }
    if (myTokenContract) {
        myTokenContract.removeAllListeners();
    }
    
    // Adjuntar nuevos listeners
    listenToMarketplaceEvents();

    // Adjuntar listener para el evento 'Transfer' de MyToken
    myTokenContract.on("Transfer", async (from, to, value) => {
        addLog(`🔔 Evento 'Transfer' de MTK: De ${from.slice(0,6)}... a ${to.slice(0,6)}... valor ${ethers.utils.formatUnits(value, 18)} MTK.`, 'info');
        // Si la cuenta actual está involucrada en la transferencia (como remitente o receptor), actualizar la UI
        if (currentAccount && (from.toLowerCase() === currentAccount.toLowerCase() || to.toLowerCase() === currentAccount.toLowerCase())) {
            console.log(`DEBUG: Transfer event involves current account (${currentAccount}), updating UI.`);
            await updateUI();
        }
    });
    addLog("✅ Listener de eventos 'Transfer' de MyToken activado.", 'success');

    console.log("DEBUG: initializeContracts: Contracts initialized and listeners attached.");
}

// ---------- Conectar billetera MetaMask
async function connectWallet() {
    console.log("DEBUG: connectWallet: connectWallet function called.");
    if (!window.ethereum) {
        alert("Necesitas tener MetaMask instalado.");
        addLog("❌ MetaMask no está instalado.", 'error');
        return;
    }

    try {
        addLog("⏳ Solicitando conexión a MetaMask...", 'info');
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length === 0) {
            addLog("No hay cuentas conectadas.", 'error');
            if (connectButton) {
                connectButton.textContent = "Conectar Billetera";
                connectButton.disabled = false;
            }
            return;
        }

        currentAccount = accounts[0];
        accountAddress.textContent = currentAccount;
        connectStatus.textContent = "Conectado";
        connectStatus.classList.remove("status-disconnected");
        connectStatus.classList.add("status-connected");

        if (addNetworkButton) {
            addNetworkButton.style.display = 'none';
        }
        if (connectButton) {
            connectButton.textContent = "Conectado";
            connectButton.disabled = true;
        }

        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        console.log("DEBUG: connectWallet: Signer after assignment:", signer);

        initializeContracts(); // Initialize contracts with the new signer

        // Make user NFT and minting sections visible by removing the 'hidden' class
        if (mintNftSection) mintNftSection.classList.remove('hidden');
        if (userNftsCollectionSection) userNftsCollectionSection.classList.remove('hidden');


        await updateUI();
        await loadUserNFTs();
        // NOTE: loadMarketplaceItems() is NOT called here to prevent automatic marketplace loading.
        // It will only load when the user clicks the "Reload Marketplace" button.

        addLog("✅ Billetera conectada.", 'success');
        console.log("DEBUG: connectWallet: Connection successful and UI updated.");
    } catch (e) {
        addLog("❌ Error conectando billetera: " + e.message, 'error');
        console.error("DEBUG: connectWallet: Error in connection:", e);
        if (addNetworkButton) {
            addNetworkButton.style.display = 'block';
        }
        if (connectButton) {
            connectButton.textContent = "Conectar Billetera";
            connectButton.disabled = false;
        }
    }
}

// ---------- Show/hide minting form
function toggleMintFormVisibility() {
    if (mintFormContainer) { // Ensure the container exists
        mintFormContainer.classList.toggle('hidden'); // Use Tailwind's 'hidden' class
        if (!mintFormContainer.classList.contains('hidden')) {
            // If the form is shown, clear inputs and focus the first one
            if (nftNameInput) nftNameInput.value = '';
            if (nftDescriptionInput) nftDescriptionInput.value = '';
            if (nftImageInput) nftImageInput.value = ''; // Clear file input
            if (nftPriceInput) nftPriceInput.value = LISTING_PRICE_DEFAULT;
            if (nftNameInput) nftNameInput.focus();
        }
    }
}

// ---------- Function to fetch IPFS metadata
async function fetchIpfsMetadata(tokenURI) {
    let name = "NFT Desconocido";
    let description = "Este NFT no tiene descripción disponible.";
    let imageUrl = "https://placehold.co/400x400/808080/FFFFFF?text=NFT+Image"; // Default image

    // Check for simulated CIDs from deployFullProject.js (QmTEST...)
    // If it's a simulated CID, use the placeholder logic directly without fetching
    if (tokenURI && tokenURI.startsWith("ipfs://QmTEST")) {
        const parts = tokenURI.split('/');
        const lastPart = parts[parts.length - 1]; // e.g., "metadata_0.json"
        const idMatch = lastPart.match(/(\d+)\.json$/);
        const simulatedId = idMatch ? idMatch[1] : 'unknown';

        name = `NFT Minteado #${simulatedId}`;
        description = `Un NFT generado por el script de despliegue con el ID ${simulatedId}.`;
        // Attempt to extract image URL from the simulated tokenURI if present
        const urlParamsMatch = tokenURI.match(/image=(.*)/);
        if (urlParamsMatch && urlParamsMatch[1]) {
            try {
                imageUrl = decodeURIComponent(urlParamsMatch[1]);
            } catch (e) {
                console.warn("Error decoding image URL from simulated tokenURI:", e);
            }
        } else {
            // Fallback for simulated image if not in URL params
            imageUrl = `https://placehold.co/400x400/${Math.floor(Math.random()*16777215).toString(16)}/FFFFFF?text=NFT+${simulatedId}`;
        }
        
        return { name, description, image: imageUrl };

    } else if (tokenURI && tokenURI.startsWith("ipfs://")) {
        // This is for real IPFS CIDs uploaded via Pinata
        const ipfsHash = tokenURI.replace("ipfs://", "");
        // Try multiple gateways for robustness
        const metadataGateways = [
            `https://ipfs.io/ipfs/${ipfsHash}`,
            `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
            `https://cloudflare-ipfs.com/ipfs/${ipfsHash}` // Another common gateway
        ];

        let metadata;
        for (const gatewayUrl of metadataGateways) {
            try {
                const response = await fetch(gatewayUrl);
                if (response.ok) {
                    metadata = await response.json();
                    console.log(`DEBUG: Metadatos IPFS cargados exitosamente desde: ${gatewayUrl}`);
                    break; // Exit loop on first successful fetch
                }
            } catch (e) {
                console.warn(`DEBUG: Fallo al intentar cargar metadatos desde ${gatewayUrl}:`, e);
            }
        }

        if (metadata) {
            name = metadata.name || name;
            description = metadata.description || description;
            
            // Handle image URL with multiple gateways if it's an IPFS URI
            if (metadata.image && metadata.image.startsWith("ipfs://")) {
                const imageIpfsHash = metadata.image.replace("ipfs://", "");
                const imageGateways = [
                    `https://ipfs.io/ipfs/${imageIpfsHash}`,
                    `https://gateway.pinata.cloud/ipfs/${imageIpfsHash}`,
                    `https://cloudflare-ipfs.com/ipfs/${imageIpfsHash}`
                ];

                let imageFound = false;
                for (const imgGatewayUrl of imageGateways) {
                    try {
                        const imgResponse = await fetch(imgGatewayUrl);
                        if (imgResponse.ok) {
                            imageUrl = imgGatewayUrl; // Use the successful gateway URL
                            imageFound = true;
                            console.log(`DEBUG: Imagen IPFS cargada exitosamente desde: ${imgGatewayUrl}`);
                            break;
                        }
                    } catch (e) {
                        console.warn(`DEBUG: Fallo al intentar cargar imagen desde ${imgGatewayUrl}:`, e);
                    }
                }
                if (!imageFound) {
                    addLog(`⚠️ No se pudo cargar la imagen para URI ${metadata.image} desde ningún gateway. Usando imagen por defecto.`, 'warning');
                }
            } else if (metadata.image) {
                imageUrl = metadata.image; // Use as is if it's a regular URL
            }
        } else {
            // If all metadata gateways fail
            addLog(`⚠️ No se pudieron cargar los metadatos para URI ${tokenURI} desde ningún gateway. Usando valores por defecto.`, 'warning');
        }
    } else {
        console.warn("TokenURI no es un formato IPFS reconocido o está vacío:", tokenURI);
        addLog(`⚠️ TokenURI "${tokenURI}" no es un formato IPFS reconocido.`, 'warning');
    }

    return { name, description, image: imageUrl };
}


// ---------- Mint NFT with form (NOW WITH PINATA INTEGRATION)
async function createAndMintNFT(e) { 
    e.preventDefault(); // Prevent default form submission

    if (!signer || !currentAccount) {
        alert("Conecta tu billetera primero.");
        addLog("❌ No hay firmante o cuenta para mintear NFT.", 'error');
        return;
    }
    if (!myNFTContract) {
        addLog("❌ Contrato MyNFT no inicializado para mintear.", 'error');
        return;
    }

    const name = nftNameInput.value.trim(); 
    const description = nftDescriptionInput.value.trim();
    const imageFile = nftImageInput.files[0]; // Get the image file
    const price = nftPriceInput.value.trim(); 

    if (!name || !description || !imageFile || !price) { 
        addLog("Por favor, rellena todos los campos y selecciona una imagen para el NFT.", 'warning');
        return;
    }

    addLog(`⏳ Minteando NFT '${name}'...`, 'info');

    try {
        // Disable form buttons
        if (createNftButton) {
            createNftButton.disabled = true;
            createNftButton.textContent = "Subiendo a IPFS...";
        }
        if (cancelMintButton) {
            cancelMintButton.disabled = true;
        }

        // Use FormData to send both file and text data to the backend
        const formData = new FormData();
        formData.append('image', imageFile); // 'image' must match the field name in multer setup on backend
        formData.append('name', name);
        formData.append('description', description);
        formData.append('rarity', 'Común'); // You can add a rarity input later if needed
        formData.append('price', price);
        formData.append('creatorAddress', currentAccount);

        // Send data to backend for IPFS upload and tokenURI generation
        const response = await fetch('http://localhost:3001/mint-nft', { // Corrected endpoint
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Error del backend: ${response.status} - ${errorData.error || 'Error desconocido'}`);
        }

        const data = await response.json();
        const tokenURI = data.tokenURI; // Get the real IPFS tokenURI from the backend
        addLog(`✅ Backend generó Token URI: ${tokenURI}`, 'success');

        // 3. Mint the NFT with the generated tokenURI
        addLog(`⏳ Minteando NFT "${name}" en la blockchain...`, 'info');
        if (createNftButton) {
            createNftButton.textContent = "Minteando en Blockchain...";
        }

        const tx = await myNFTContract.safeMint(currentAccount, tokenURI, { gasLimit: 300000 });
        const receipt = await tx.wait(); 

        let tokenId = null;
        // Look for the Transfer event to get the tokenId
        for (const log of receipt.logs) {
            try {
                const parsedLog = myNFTContract.interface.parseLog(log);
                // The Transfer event for minting from address(0)
                if (parsedLog.name === "Transfer" && parsedLog.args.from === ethers.constants.AddressZero) {
                    tokenId = parsedLog.args.tokenId.toString();
                    break;
                }
            } catch (parseError) {
                // Ignore logs that cannot be parsed by myNFTContract interface
            }
        }
        
        if (tokenId) {
            mintedNftPrices[tokenId] = price; // Store the price for future reference
            addLog(`🎉 NFT '${name}' (ID: ${tokenId}) minteado exitosamente! Precio de listado guardado: ${price} MTK.`, 'success');
            alert(`NFT '${name}' (ID: ${tokenId}) minteado directamente a tu billetera.`);
        } else {
            addLog(`🎉 NFT '${name}' minteado exitosamente, pero no se pudo obtener el ID del evento.`, 'success');
            alert(`NFT '${name}' minteado directamente a tu billetera.`);
        }

        // Clear form and hide it
        if (mintFormContainer) mintFormContainer.classList.add('hidden');
        if (nftNameInput) nftNameInput.value = '';
        if (nftDescriptionInput) nftDescriptionInput.value = '';
        if (nftImageInput) nftImageInput.value = '';
        if (nftPriceInput) nftPriceInput.value = LISTING_PRICE_DEFAULT; 

        await updateUI();
        await loadUserNFTs(); 
    } catch (error) {
        addLog("❌ Error minteando NFT: " + (error.message || error.code), 'error');
        alert("Error minteando NFT: " + (error.message || error.code));
        console.error(error);
    } finally {
        // Re-enable form buttons
        if (createNftButton) {
            createNftButton.disabled = false;
            createNftButton.textContent = "Crear NFT";
        }
        if (cancelMintButton) {
            cancelMintButton.disabled = false;
        }
    }
}

// ---------- Update UI (balance and general status)
async function updateUI() {
    console.log("DEBUG: updateUI: updateUI function called.");
    if (!signer || !currentAccount) {
        addLog("ℹ️ No hay firmante o cuenta para actualizar la UI.", 'info');
        console.log("DEBUG: updateUI: No signer or currentAccount. Exiting.");
        return;
    }

    try {
        if (!myTokenContract) {
            addLog("❌ Contrato MyToken no inicializado para actualizar el balance.", 'error');
            console.error("DEBUG: updateUI: myTokenContract is null.");
            if (mtkBalanceSpan) mtkBalanceSpan.textContent = "Error";
            return;
        }
        
        console.log(`DEBUG: updateUI: Fetching balance for account: ${currentAccount}`);
        const balance = await myTokenContract.balanceOf(currentAccount);
        console.log(`DEBUG: updateUI: Raw balance received: ${balance.toString()}`); // Log raw balance
        
        if (mtkBalanceSpan) {
            mtkBalanceSpan.textContent = parseFloat(ethers.utils.formatUnits(balance, 18)).toFixed(2);
        }
        addLog(`✅ Balance de MTK actualizado: ${mtkBalanceSpan ? mtkBalanceSpan.textContent : 'N/A'}`, 'success');
    } catch (e) {
        addLog("❌ Error actualizando balance: " + e.message, 'error'); // Added log for errors
        console.error("DEBUG: Error updating balance:", e);
        if (mtkBalanceSpan) mtkBalanceSpan.textContent = "Error"; // Display error in UI
    }
}

// ---------- Load user NFTs
async function loadUserNFTs() {
    if (isUserNFTsLoading) {
        console.warn("DEBUG: loadUserNFTs: Already loading, preventing re-entry.");
        return; // Prevent re-entry
    }
    isUserNFTsLoading = true;
    console.log("DEBUG: loadUserNFTs: Starting function call.");

    if (!signer || !currentAccount) {
        addLog("ℹ️ No hay firmante o cuenta para cargar los NFTs del usuario.", 'info');
        console.log("DEBUG: loadUserNFTs: No signer or currentAccount. Exiting.");
        isUserNFTsLoading = false;
        return;
    }

    if (!userNftsGrid || !userNftsCountSpan) {
        addLog("❌ Error: Elementos DOM de NFT de usuario no encontrados.", 'error');
        console.error("DEBUG-USER-NFT: ERROR: Element #user-nfts-grid or #user-nfts-count not found in HTML.");
        isUserNFTsLoading = false;
        return;
    }

    try {
        if (!myNFTContract) {
            addLog("❌ Contrato MyNFT no inicializado para cargar los NFTs del usuario.", 'error');
            console.error("DEBUG: loadUserNFTs: myNFTContract is null.");
            userNftsCountSpan.textContent = "Error";
            userNftsGrid.innerHTML = '<p class="text-gray-400">Error cargando tus NFTs.</p>';
            isUserNFTsLoading = false;
            return;
        }
        if (!marketplaceContract) {
            addLog("❌ Contrato del Marketplace no inicializado para verificar el estado de listado de NFTs.", 'error');
            console.warn("DEBUG-USER-NFT: marketplaceContract is null. Cannot verify listing status.");
        }

        const balance = await myNFTContract.balanceOf(currentAccount);
        userNftsCountSpan.textContent = balance.toString();
        userNftsGrid.innerHTML = ''; // Clear the grid before adding new elements
        console.log(`DEBUG-USER-NFT: userNftsGrid cleared. Balance reported by contract: ${balance.toString()}`);

        if (balance.eq(0)) {
            userNftsGrid.innerHTML = '<p class="text-gray-400">No tienes NFTs en tu billetera. ¡Mintea uno!</p>';
            addLog("🔄 No tienes NFTs en tu billetera.", 'info');
            console.log("DEBUG-USER-NFT: Balance is 0. Showing no NFTs message.");
            isUserNFTsLoading = false;
            return;
        }

        const uniqueTokenIdsRendered = new Set(); 
        // Iterate through all possible token IDs to find those owned by the current account
        // This is a workaround as ERC721 does not provide a direct way to get all token IDs of an owner.
        // In a production environment, you would typically use a subgraph or an off-chain indexer.
        const totalSupply = await myNFTContract.totalSupply();
        for (let i = 0; i < totalSupply; i++) {
            try {
                const tokenId = i; // Assuming token IDs are sequential from 0
                const owner = await myNFTContract.ownerOf(tokenId);
                if (owner.toLowerCase() === currentAccount.toLowerCase()) {
                    // It's an NFT owned by the user
                    if (uniqueTokenIdsRendered.has(tokenId.toString())) {
                        console.warn(`DEBUG-USER-NFT: WARNING: Attempting to render duplicate tokenId ${tokenId} in the same loadUserNFTs call.`);
                        continue; 
                    }
                    uniqueTokenIdsRendered.add(tokenId.toString());

                    // Get the tokenURI and IPFS metadata
                    let nftMetadata = { name: `NFT #${tokenId}`, description: "Cargando descripción...", image: "https://placehold.co/400x400/808080/FFFFFF?text=Cargando..." };
                    try {
                        const tokenURI = await myNFTContract.tokenURI(tokenId);
                        console.log(`DEBUG-USER-NFT: TokenURI for NFT ID ${tokenId}: ${tokenURI}`);
                        nftMetadata = await fetchIpfsMetadata(tokenURI);
                    } catch (uriError) {
                        console.warn(`DEBUG-USER-NFT: Error getting or parsing tokenURI for NFT ID ${tokenId}: ${uriError.message}`);
                    }

                    let item;
                    let isListed = false;
                    let listedPrice = LISTING_PRICE_DEFAULT;
                    let listedSeller = '';

                    if (marketplaceContract) {
                        try {
                            item = await marketplaceContract.listedItems(tokenId);
                            isListed = item.isListed;
                            if (isListed) {
                                listedPrice = ethers.utils.formatUnits(item.price, 18);
                                listedSeller = item.seller;
                            }
                            console.log(`DEBUG-USER-NFT: NFT ID ${tokenId} - isListed: ${isListed}, Price: ${listedPrice}, Seller: ${listedSeller}`);
                        } catch (marketplaceError) {
                            console.warn(`DEBUG-USER-NFT: Error getting listing status for NFT ID ${tokenId}: ${marketplaceError.message}`);
                            isListed = false;
                        }
                    }

                    let buttonHTML;
                    let statusText;
                    // Use the price saved in mintedNftPrices if it exists, otherwise the default
                    const priceForListing = mintedNftPrices[tokenId.toString()] || LISTING_PRICE_DEFAULT;

                    if (isListed && listedSeller.toLowerCase() === currentAccount.toLowerCase()) {
                        buttonHTML = `<button class="btn danger-btn" onclick="cancelListing(${tokenId})">Cancelar Listado</button>`;
                        statusText = `Listado por ti por ${listedPrice} MTK`;
                    } else if (isListed && listedSeller.toLowerCase() !== currentAccount.toLowerCase()) {
                        buttonHTML = `<span class="text-gray-400 text-sm italic">Listado por otro (${listedSeller.slice(0,6)}...)</span>`;
                        statusText = `Listado por ${listedSeller.slice(0,6)}... por ${listedPrice} MTK`;
                    } else {
                        buttonHTML = `<button class="btn success-btn" onclick="listNFT(${tokenId}, ${priceForListing})">Listar por ${priceForListing} MTK</button>`;
                        statusText = "No listado";
                    }

                    const div = document.createElement('div');
                    div.className = 'nft-card';
                    div.innerHTML = `
                        <img src="${nftMetadata.image}" alt="${nftMetadata.name}" class="w-full h-48 object-cover rounded-md mb-4 border border-blue-500" onerror="this.onerror=null;this.src='https://placehold.co/400x400/808080/FFFFFF?text=Error+Loading';">
                        <h3 class="text-xl font-bold text-blue-300">${nftMetadata.name} (#${tokenId})</h3>
                        <p class="text-gray-400 text-sm mb-2">${nftMetadata.description}</p>
                        <p>Estado: <span class="highlight">${statusText}</span></p>
                        <div class="flex flex-col mt-4"> ${buttonHTML} </div>
                    `;
                    userNftsGrid.appendChild(div);
                    console.log(`DEBUG-USER-NFT: Card added for NFT ID: ${tokenId}`);
                }
            } catch (e) {
                // ownerOf will revert if the token ID does not exist or is not valid.
                // This is expected if iterating through a range of potential token IDs.
                // console.log(`Token ID ${i} does not exist or is not owned by anyone.`);
            }
        }

        addLog(`✅ NFTs del usuario cargados. Total: ${uniqueTokenIdsRendered.size}`, 'success');
        console.log("DEBUG: loadUserNFTs: Function finished successfully.");
    } catch (e) {
        addLog("❌ Error cargando NFTs del usuario: " + e.message, 'error');
        console.error("DEBUG: Error cargando NFTs del usuario:", e);
        userNftsGrid.innerHTML = '<p class="text-gray-400">Error cargando tus NFTs.</p>';
    } finally {
        isUserNFTsLoading = false; // Reset flag
        console.log("DEBUG: loadUserNFTs: Function finished, flag reset.");
    }
}

// ---------- List NFT
async function listNFT(tokenId, price) {
    if (!signer) {
        alert("Conecta tu billetera primero.");
        addLog("❌ No hay firmante para listar NFT.", 'error');
        return;
    }
    if (!myNFTContract || !marketplaceContract) {
        addLog("❌ Contratos NFT o Marketplace no inicializados para listar.", 'error');
        return;
    }

    try {
        addLog(`⏳ Listando NFT ID ${tokenId} por ${price} MTK...`, 'info');

        // Disable all action buttons to prevent multiple transactions
        document.querySelectorAll('.nft-card .btn').forEach(btn => btn.disabled = true);
        if (listAllUserNftsButton) listAllUserNftsButton.disabled = true;

        const approveTx = await myNFTContract.approve(MARKETPLACE_ADDRESS, tokenId);
        await approveTx.wait();
        addLog("✅ Marketplace aprobado para transferir NFT.", 'success');

        const listTx = await marketplaceContract.listItem(tokenId, ethers.utils.parseUnits(price.toString(), 18));
        await listTx.wait();

        addLog(`🎉 NFT ID ${tokenId} listado exitosamente!`, 'success');
        alert(`NFT ID ${tokenId} listado.`);

        await updateUI();
        await loadUserNFTs();
        await loadMarketplaceItems(); // Reload the marketplace to show the new listed NFT
    } catch (error) {
        addLog("❌ Error listando NFT: " + (error.message || error.code), 'error');
        alert("Error listando NFT: " + (error.message || error.code));
        console.error(error);
    } finally {
        // Re-enable buttons
        document.querySelectorAll('.nft-card .btn').forEach(btn => btn.disabled = false);
        if (listAllUserNftsButton) listAllUserNftsButton.disabled = false;
    }
}

// ---------- Buy NFT
async function buyNFT(tokenId, price) {
    if (!signer) {
        alert("Conecta tu billetera primero.");
        addLog("❌ No hay firmante para comprar NFT.", 'error');
        return;
    }
    if (!myTokenContract || !marketplaceContract) {
        addLog("❌ Contratos Token o Marketplace no inicializados para comprar.", 'error');
        return;
    }

    try {
        const buyer = currentAccount;
        const item = await marketplaceContract.listedItems(tokenId);

        if (buyer.toLowerCase() === item.seller.toLowerCase()) {
            alert("No puedes comprar tu propio NFT.");
            addLog("🚫 Intento de comprar NFT propio.", 'info');
            return;
        }

        addLog(`⏳ Comprando NFT ID ${tokenId} por ${price} MTK...`, 'info');

        // Disable all action buttons
        document.querySelectorAll('.nft-card .btn').forEach(btn => btn.disabled = true);
        if (listAllUserNftsButton) listAllUserNftsButton.disabled = true;


        const priceInWei = ethers.utils.parseUnits(price.toString(), 18);
        const approveTx = await myTokenContract.approve(MARKETPLACE_ADDRESS, priceInWei);
        await approveTx.wait();
        addLog("✅ Aprobación de token confirmada.", 'success');

        const buyTx = await marketplaceContract.buyItem(tokenId);
        await buyTx.wait();

        addLog(`🎉 NFT ID ${tokenId} comprado exitosamente!`, 'success');
        alert("NFT comprado exitosamente.");

        await updateUI();
        await loadUserNFTs();
        await loadMarketplaceItems();
    } catch (e) {
        addLog("❌ Error comprando NFT: " + (e.message || e.code), 'error');
        alert("Error comprando NFT: " + (e.message || e.code));
        console.error(e);
    } finally {
        // Re-enable buttons
        document.querySelectorAll('.nft-card .btn').forEach(btn => btn.disabled = false);
        if (listAllUserNftsButton) listAllUserNftsButton.disabled = false;
    }
}

// ---------- Cancel NFT listing
async function cancelListing(tokenId) {
    if (!signer) {
        alert("Conecta tu billetera primero.");
        addLog("❌ No hay firmante para cancelar listado.", 'error');
        return;
    }
    if (!marketplaceContract) {
        addLog("❌ Contrato del Marketplace no inicializado para cancelar listado.", 'error');
        return;
    }

    try {
        addLog(`⏳ Cancelando listado para NFT ID ${tokenId}...`, 'info');

        // Disable all action buttons
        document.querySelectorAll('.nft-card .btn').forEach(btn => btn.disabled = true);
        if (listAllUserNftsButton) listAllUserNftsButton.disabled = true;

        const cancelTx = await marketplaceContract.cancelListing(tokenId);
        await cancelTx.wait();

        addLog(`🎉 Listado para NFT ID ${tokenId} cancelado.`, 'success');
        alert("Listado cancelado.");

        await updateUI();
        await loadUserNFTs();
        await loadMarketplaceItems();
    } catch (e) {
        addLog("❌ Error cancelando listado: " + (e.message || e.code), 'error');
        alert("Error cancelando listado: " + (e.message || e.code));
        console.error(e);
    } finally {
        // Re-enable buttons
        document.querySelectorAll('.nft-card .btn').forEach(btn => btn.disabled = false);
        if (listAllUserNftsButton) listAllUserNftsButton.disabled = false;
    }
}

// ---------- Load listed NFTs in the marketplace
async function loadMarketplaceItems() {
    if (isMarketplaceLoading) {
        console.warn("DEBUG-LMI: Already loading, preventing re-entry.");
        return; // Prevent re-entry
    }
    isMarketplaceLoading = true;
    addLog("Cargando ítems del marketplace...", 'info');
    console.log("DEBUG-LMI: Starting loadMarketplaceItems function.");
    
    // Ensure marketplaceGrid is defined
    if (!marketplaceGrid) {
        marketplaceGrid = document.getElementById('marketplace-grid'); 
    }

    if (!marketplaceGrid) {
        addLog("❌ Error: Contenedor del Marketplace (ID 'marketplace-grid') no encontrado.", 'error');
        console.error("DEBUG-LMI: ERROR: Element #marketplace-grid not found in HTML.");
        isMarketplaceLoading = false;
        return;
    }
    
    // Clear grid content before loading new items to avoid duplication
    marketplaceGrid.innerHTML = '<p class="text-gray-400">Cargando ítems...</p>';
    console.log("DEBUG-LMI: Marketplace content cleared.");

    if (!signer || !marketplaceContract || !myNFTContract) { 
        marketplaceGrid.innerHTML = '<p class="text-gray-400">Marketplace no disponible o billetera no conectada.</p>';
        addLog("❌ Marketplace no disponible o billetera no conectada para cargar ítems.", 'error');
        console.error("DEBUG-LMI: Signer, marketplaceContract, or myNFTContract is null.");
        isMarketplaceLoading = false;
        return;
    }

    try {
        console.log("DEBUG-LMI: Attempting to get listed IDs from contract.");
        const tokenIdsBN = await marketplaceContract.getListedTokenIds();
        const tokenIds = tokenIdsBN.map(bn => Number(bn)); // Convert BigNumber to Number
        marketplaceGrid.innerHTML = ''; // Clear again after getting IDs, before adding cards

        if (tokenIds.length === 0) {
            marketplaceGrid.innerHTML = '<p class="text-gray-400">No hay NFTs listados en este momento.</p>';
            addLog(`🔄 No hay NFTs listados en el marketplace.`, 'info');
            isMarketplaceLoading = false;
            return;
        }

        console.log("DEBUG-LMI: Iterating over listed IDs to render.");
        for (let tokenId of tokenIds) {
            const item = await marketplaceContract.listedItems(tokenId);
            if (!item.isListed) {
                addLog(`ℹ️ NFT ID ${tokenId} encontrado en la lista de IDs pero no está listado.`, 'info');
                continue;
            }

            const seller = item.seller;
            const priceMTK = ethers.utils.formatUnits(item.price, 18);

            // Get the tokenURI and IPFS metadata
            let nftMetadata = { name: `NFT #${tokenId}`, description: "Cargando descripción...", image: "https://placehold.co/400x400/808080/FFFFFF?text=Cargando..." };
            try {
                const tokenURI = await myNFTContract.tokenURI(tokenId);
                console.log(`DEBUG-LMI: TokenURI for NFT ID ${tokenId}: ${tokenURI}`);
                nftMetadata = await fetchIpfsMetadata(tokenURI);
            } catch (uriError) {
                console.warn(`DEBUG-LMI: Error getting or parsing tokenURI for NFT ID ${tokenId}: ${uriError.message}`);
            }

            let buttonHTML;
            if (currentAccount && seller.toLowerCase() === currentAccount.toLowerCase()) {
                buttonHTML = `<button class="btn danger-btn" onclick="cancelListing(${tokenId})">Cancelar Listado</button>`;
            } else {
                buttonHTML = `<button class="btn info-btn" onclick="buyNFT(${tokenId}, '${priceMTK}')">Comprar</button>`;
            }

            const card = document.createElement('div');
            card.className = 'nft-card';
            card.innerHTML = `
                <img src="${nftMetadata.image}" alt="${nftMetadata.name}" class="w-full h-48 object-cover rounded-md mb-4 border border-blue-500" onerror="this.onerror=null;this.src='https://placehold.co/400x400/808080/FFFFFF?text=Error+Loading';">
                <h3 class="text-xl font-bold text-blue-300">${nftMetadata.name} (#${tokenId})</h3>
                <p class="text-gray-400 text-sm mb-2">${nftMetadata.description}</p>
                <p>Precio: <span class="highlight">${priceMTK}</span> MTK</p>
                <p>Vendedor: <span class="truncate">${seller.slice(0,6)}...${seller.slice(-4)}</span></p>
                ${buttonHTML}
            `;

            marketplaceGrid.appendChild(card);
        }

        addLog(`✅ Marketplace cargado con ${tokenIds.length} NFTs listados.`, 'success');
    } catch (e) {
        addLog("❌ Error cargando marketplace: " + e.message, 'error');
        console.error("DEBUG-LMI: Error cargando marketplace:", e);
        marketplaceGrid.innerHTML = '<p class="text-gray-400">Error cargando NFTs.</p>';
    } finally {
        isMarketplaceLoading = false; // Reset flag
        console.log("DEBUG-LMI: Function finished, flag reset.");
    }
}

// ---------- List all user NFTs if not listed
async function listAllUserNFTsIfNotListed() {
    if (!signer || !currentAccount) {
        alert("Conecta tu billetera primero.");
        addLog("❌ No hay firmante o cuenta para listar todos los NFTs.", 'error');
        return;
    }
    if (!myNFTContract || !marketplaceContract) {
        addLog("❌ Contratos NFT o Marketplace no inicializados para listar todos los NFTs.", 'error');
        return;
    }

    addLog("⏳ Intentando listar todos los NFTs no listados...", 'info');
    if (listAllUserNftsButton) {
        listAllUserNftsButton.disabled = true;
        listAllUserNftsButton.textContent = "Listando...";
    }

    try {
        const balance = await myNFTContract.balanceOf(currentAccount);
        let listedCount = 0;

        const totalSupply = await myNFTContract.totalSupply();
        for (let i = 0; i < totalSupply; i++) {
            try {
                const tokenId = i;
                const owner = await myNFTContract.ownerOf(tokenId);
                if (owner.toLowerCase() === currentAccount.toLowerCase()) {
                    const item = await marketplaceContract.listedItems(tokenId);
                    if (!item.isListed) {
                        // Use the price saved in mintedNftPrices if it exists, otherwise the default
                        const priceToUse = mintedNftPrices[tokenId.toString()] || LISTING_PRICE_DEFAULT;
                        addLog(`⏳ Listando NFT ID ${tokenId} con precio ${priceToUse} MTK...`, 'info');
                        await listNFT(tokenId.toString(), priceToUse);
                        listedCount++;
                    }
                }
            } catch (e) {
                // ownerOf will revert if the token ID does not exist or is not valid.
                // This is expected if iterating through a range of potential token IDs.
            }
        }
        addLog(`🎉 ${listedCount} nuevos NFTs listados.`, 'success');
        alert(`${listedCount} nuevos NFTs listados.`);

    } catch (e) {
        addLog("❌ Error listando todos los NFTs: " + e.message, 'error');
        console.error(e);
        alert("Error listando todos los NFTs: " + (e.message || e.code));
    } finally {
        if (listAllUserNftsButton) {
            listAllUserNftsButton.disabled = false;
            listAllUserNftsButton.textContent = "Listar todos mis NFTs no listados";
        }
        await updateUI();
        await loadUserNFTs();
        await loadMarketplaceItems(); // Reload the marketplace after listing all NFTs
    }
}

// ---------- Marketplace events to update UI
function listenToMarketplaceEvents() {
    if (marketplaceContract) {
        // Remove previous listeners to avoid duplicates
        marketplaceContract.removeAllListeners();

        marketplaceContract.on("NFTListed", async (tokenId, seller, price) => {
            addLog(`🔔 Evento 'NFTListed': NFT ID ${tokenId.toString()} listado por ${seller.slice(0,6)}... por ${ethers.utils.formatUnits(price, 18)} MTK.`, 'info');
            await updateUI();
            await loadUserNFTs();
            await loadMarketplaceItems();
        });

        marketplaceContract.on("NFTBought", async (tokenId, buyer, price) => {
            addLog(`🔔 Evento 'NFTBought': NFT ID ${tokenId.toString()} comprado por ${buyer.slice(0,6)}... por ${ethers.utils.formatUnits(price, 18)} MTK.`, 'success');
            await updateUI();
            await loadUserNFTs();
            await loadMarketplaceItems();
        });

        marketplaceContract.on("ListingCancelled", async (tokenId, seller) => {
            addLog(`🔔 Evento 'ListingCancelled': Listado para NFT ID ${tokenId.toString()} cancelado por ${seller.slice(0,6)}....`, 'info');
            await updateUI();
            await loadUserNFTs();
            await loadMarketplaceItems();
        });

        addLog("✅ Listeners de eventos del Marketplace activados.", 'success');
    } else {
        console.warn("DEBUG: Could not attach event listeners: marketplaceContract is null.");
    }
}

// ---------- Add Hardhat network to MetaMask
async function addHardhatNetwork() {
    if (!window.ethereum) {
        alert("No tienes MetaMask instalado.");
        addLog("❌ MetaMask no está instalado para añadir la red.", 'error');
        return;
    }

    try {
        await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
                chainId: '0x7A69', // 31337 decimal
                chainName: 'Hardhat Localhost',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['http://127.0.0.1:8545'],
                blockExplorerUrls: []
            }]
        });
        addLog("✅ Red Hardhat añadida a MetaMask.", 'success');
        alert("Red Hardhat añadida, conéctate a ella.");
    } catch (e) {
        addLog("❌ Error añadiendo red: " + e.message, 'error');
        console.error(e);
    }
}

// ---------- Detect account change and update everything
if (window.ethereum) {
    window.ethereum.on('accountsChanged', async (accounts) => {
        addLog(`🔄 Cambio de cuenta detectado.`, 'info');
        if (accounts.length === 0) {
            window.location.reload();
            return;
        }

        currentAccount = accounts[0];
        if (accountAddress) accountAddress.textContent = currentAccount;
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();

        const marketplaceGridElement = document.getElementById('marketplace-grid');
        const userNftsGridElement = document.getElementById('user-nfts-grid');

        if (marketplaceGridElement) marketplaceGridElement.innerHTML = '<p class="text-gray-400">Cargando ítems...</p>';
        if (userNftsGridElement) userNftsGridElement.innerHTML = '<p class="text-gray-400">Cargando tus NFTs...</p>';

        initializeContracts();

        if (mintNftSection) mintNftSection.classList.remove('hidden');
        if (userNftsCollectionSection) userNftsCollectionSection.classList.remove('hidden');

        await updateUI();
        await loadUserNFTs();
        // NOTE: loadMarketplaceItems() is NOT called here to prevent automatic marketplace loading.
        addLog(`✅ UI actualizada para la cuenta: ${currentAccount.slice(0,6)}...`, 'success');
    });

    window.ethereum.on('chainChanged', (chainId) => {
        addLog(`🔄 Red cambiada a Chain ID: ${chainId}. Recargando página...`, 'info');
        window.location.reload();
    });
}

// ---------- Initial application load when DOM is ready
window.addEventListener('DOMContentLoaded', async () => {
    // Get DOM element references here, when they are guaranteed to exist.
    connectButton = document.getElementById('connect-button');
    connectStatus = document.getElementById('connect-status');
    accountAddress = document.getElementById('account-address');
    mtkBalanceSpan = document.getElementById('mtk-balance');
    logList = document.getElementById('log-list');
    marketplaceContainer = document.getElementById('marketplace-container');
    marketplaceGrid = document.getElementById('marketplace-grid'); // Assign marketplaceGrid here

    mintNftSection = document.getElementById('mint-nft-section');
    mintFormContainer = document.getElementById('mint-form-container');
    mintForm = document.getElementById('mint-form');
    nftNameInput = document.getElementById('nft-name');
    nftDescriptionInput = document.getElementById('nft-description'); // Assign new input
    nftImageInput = document.getElementById('nft-image'); // Assign new input
    nftPriceInput = document.getElementById('nft-price');
    toggleMintFormButton = document.getElementById('toggle-mint-form');
    createNftButton = document.getElementById('create-nft-button');
    cancelMintButton = document.getElementById('cancel-mint');

    userNftsCollectionSection = document.getElementById('user-nfts-collection-section');
    userNftsGrid = document.getElementById('user-nfts-grid');
    userNftsCountSpan = document.getElementById('user-nfts-count'); 

    addNetworkButton = document.getElementById('add-network-button');
    loadMarketplaceButton = document.getElementById('load-marketplace-button');
    listAllUserNftsButton = document.getElementById('list-all-user-nfts-button'); 

    await loadABIs(); // Load ABIs first

    // Attach connect button listener. No automatic connection here.
    if (connectButton) connectButton.addEventListener('click', connectWallet);
    
    if (addNetworkButton) addNetworkButton.addEventListener('click', addHardhatNetwork);
    if (loadMarketplaceButton) loadMarketplaceButton.addEventListener('click', loadMarketplaceItems);
    if (listAllUserNftsButton) listAllUserNftsButton.addEventListener('click', async () => {
        addLog("🔘 Listando todos los NFTs del usuario no listados...", 'info');
        await listAllUserNFTsIfNotListed();
    });

    // Listeners for the minting form
    if (toggleMintFormButton) toggleMintFormButton.addEventListener('click', toggleMintFormVisibility);
    if (mintForm) mintForm.addEventListener('submit', createAndMintNFT); // Form submission calls createAndMintNFT
    if (cancelMintButton) cancelMintButton.addEventListener('click', toggleMintFormVisibility); // Cancel also hides the form

});


// ---------- Functions globally exposed for dynamic buttons (onclick in HTML)
window.listNFT = listNFT;
window.buyNFT = buyNFT;
window.cancelListing = cancelListing;
// window.burnNFT = burnNFT; // Removed for now
