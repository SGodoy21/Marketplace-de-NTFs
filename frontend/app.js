// Direcciones de los contratos desplegados (¡ACTUALIZA ESTAS DIRECCIONES CON LAS DE TU DESPLIEGUE!)
const MY_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const MY_NFT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const MARKETPLACE_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const LISTING_PRICE = "100"; // Precio del NFT de prueba en tokens MTK (100 MTK)

// ABIs de los contratos (se cargan desde los archivos JSON)
let MyTokenABI;
let MyNFTABI;
let MarketplaceABI;

// Instancias de Ethers.js
let provider;
let signer;
let myTokenContract;
let myNFTContract;
let marketplaceContract;

// Elementos del DOM
const connectButton = document.getElementById('connect-button');
const connectStatus = document.getElementById('connect-status');
const accountAddress = document.getElementById('account-address');
const mtkBalanceSpan = document.getElementById('mtk-balance');
const nftActionsSection = document.getElementById('nft-actions');
const listNftButton = document.getElementById('list-nft-button');
// Ya no necesitamos buyNftButton ni cancelListingButton para el NFT de prueba si los listamos dinámicamente
// pero los mantendremos para la lógica específica del NFT ID 0.
const buyNftButton = document.getElementById('buy-nft-button');
const cancelListingButton = document.getElementById('cancel-listing-button');
const nftOwnerSpan = document.getElementById('nft-owner');
const listingStatusSpan = document.getElementById('listing-status');
const logList = document.getElementById('log-list');
const marketplaceContainer = document.getElementById("marketplace-container"); // Nuevo elemento

// Función para añadir logs a la interfaz
function addLog(message) {
    const listItem = document.createElement('li');
    listItem.textContent = message;
    logList.prepend(listItem); // Añadir al principio para ver los más recientes
}

// Función para cargar los ABIs desde los archivos JSON
async function loadABIs() {
    try {
        const tokenResponse = await fetch('MyToken.json');
        MyTokenABI = await tokenResponse.json();
        
        const nftResponse = await fetch('MyNFT.json');
        MyNFTABI = await nftResponse.json();
        
        const marketplaceResponse = await fetch('Marketplace.json');
        MarketplaceABI = await marketplaceResponse.json();
        
        addLog("✅ ABIs de contratos cargados correctamente.");
    } catch (error) {
        addLog(`❌ Error al cargar los ABI: ${error.message}`);
        console.error("Error al cargar los ABI:", error);
    }
}

// ======================================================================================
// 1. CONEXIÓN A LA BILLETERA (METAMASK)
// ======================================================================================

async function connectWallet() {
    try {
        if (!window.ethereum) {
            alert('¡MetaMask no está instalado! Instálalo para usar esta dApp.');
            return;
        }

        // Crear un proveedor de Ethers.js usando el objeto ethereum de MetaMask
        provider = new ethers.providers.Web3Provider(window.ethereum);
        
        // Pide al usuario que conecte su cuenta. Esto también inicializa el signer.
        await provider.send("eth_requestAccounts", []);
        
        // Obtener el signer para enviar transacciones
        signer = provider.getSigner();
        const address = await signer.getAddress();
        
        connectStatus.textContent = "Conectado";
        accountAddress.textContent = address;
        connectButton.textContent = "Conectado";
        connectButton.disabled = true;
        nftActionsSection.style.display = 'block'; // Mostrar la sección de acciones de NFT
        
        addLog(`✅ Billetera conectada: ${address}`);

        // Inicializa las instancias de los contratos una vez que el signer esté disponible
        initializeContracts();
        
        // Carga y actualiza todos los datos de la interfaz
        await updateUI();
        await loadMarketplaceItems(); // Cargar los ítems del marketplace al conectar
        
    } catch (error) {
        addLog(`❌ Error al conectar: ${error.message}`);
        console.error("Error al conectar la billetera:", error);
    }
}

// ======================================================================================
// 2. INICIALIZAR INSTANCIAS DE CONTRATOS
// ======================================================================================

function initializeContracts() {
    // Inicializa el contrato MyToken con el signer (para escribir transacciones)
    myTokenContract = new ethers.Contract(MY_TOKEN_ADDRESS, MyTokenABI.abi, signer);
    
    // Inicializa el contrato MyNFT con el signer
    myNFTContract = new ethers.Contract(MY_NFT_ADDRESS, MyNFTABI.abi, signer);
    
    // Inicializa el contrato Marketplace con el signer
    marketplaceContract = new ethers.Contract(MARKETPLACE_ADDRESS, MarketplaceABI.abi, signer);
    
    addLog("✅ Instancias de contratos inicializadas.");
    
    // Escuchar eventos del Marketplace (según el documento)
    listenToMarketplaceEvents();
}

// ======================================================================================
// 3. LEER DATOS DESDE LA BLOCKCHAIN Y ACTUALIZAR UI
// ======================================================================================

async function updateUI() {
    try {
        // Manejar el caso donde el signer no está disponible (al desconectarse)
        if (!signer) {
            connectStatus.textContent = "Desconectado";
            accountAddress.textContent = "N/A";
            mtkBalanceSpan.textContent = "0";
            nftActionsSection.style.display = 'none';
            connectButton.textContent = "Conectar Billetera";
            connectButton.disabled = false;
            return; // Salir de la función si no hay un signer
        }

        const userAddress = await signer.getAddress();
        
        // Obtener y mostrar el balance del token MTK
        const balanceWei = await myTokenContract.balanceOf(userAddress);
        const balanceMTK = ethers.utils.formatUnits(balanceWei, 18);
        mtkBalanceSpan.textContent = balanceMTK;
        addLog(`Actualizando balance: ${balanceMTK} MTK para ${userAddress.substring(0,6)}...${userAddress.substring(userAddress.length - 4)}`);

        // Obtener el propietario del NFT de prueba (ID 0)
        const nftOwner = await myNFTContract.ownerOf(0);
        nftOwnerSpan.textContent = `${nftOwner.substring(0,6)}...${nftOwner.substring(nftOwner.length - 4)}`;
        
        // Comprobar si el NFT de prueba (ID 0) está listado en el Marketplace
        const item = await marketplaceContract.listedItems(0); // Esto accede al mapeo `listedItems` directamente
        
        // Habilitar/deshabilitar botones de acción para el NFT ID 0 (específico)
        if (item.isListed) {
            const formattedPrice = ethers.utils.formatUnits(item.price, 18);
            listingStatusSpan.textContent = `Listado por ${item.seller.substring(0,6)}...${item.seller.substring(item.seller.length - 4)} por ${formattedPrice} MTK`;
            
            if (item.seller.toLowerCase() === userAddress.toLowerCase()) {
                // Si el usuario es el vendedor, puede cancelar la venta de SU NFT ID 0
                buyNftButton.style.display = 'none';
                listNftButton.style.display = 'none';
                cancelListingButton.style.display = 'block';
            } else {
                // Si el usuario NO es el vendedor, puede comprar el NFT ID 0
                buyNftButton.style.display = 'block';
                listNftButton.style.display = 'none';
                cancelListingButton.style.display = 'none';
            }
        } else {
            listingStatusSpan.textContent = "No listado";
            
            // Si el NFT ID 0 no está listado y el usuario es el dueño, puede listarlo
            if (nftOwner.toLowerCase() === userAddress.toLowerCase()) {
                listNftButton.style.display = 'block';
                buyNftButton.style.display = 'none';
                cancelListingButton.style.display = 'none';
            } else {
                // Si el usuario no es el dueño del NFT ID 0 y no está listado, no puede hacer nada con él
                listNftButton.style.display = 'none';
                buyNftButton.style.display = 'none';
                cancelListingButton.style.display = 'none';
            }
        }

    } catch (error) {
        addLog(`❌ Error al actualizar la UI: ${error.message || error.code}`);
        console.error("Error al actualizar la UI:", error);
    }
}

/**
 * @dev Fetches and renders the NFTs available for sale in the marketplace.
 * Esto asume que el contrato Marketplace tiene una función para obtener TODOS los ítems listados.
 * Si no la tiene, deberá agregarse al contrato Solidity.
 */
async function loadMarketplaceItems() {
    addLog("Cargando ítems del marketplace...");
    
    if (!marketplaceContainer) {
        console.error("No se encontró el elemento #marketplace-container en el HTML.");
        return;
    }
    
    // Limpiar el contenedor antes de renderizar
    marketplaceContainer.innerHTML = '<h2>NFTs en el Marketplace</h2>';

    try {
        // --- AQUÍ NECESITAS LA FUNCIÓN EN TU CONTRATO MARKETPLACE.SOL ---
        // Tu contrato Marketplace.sol actual no tiene una función 'getListedItems()'.
        // La implementación que te proporcioné de Marketplace.sol usa un mapeo `listedItems(tokenId)`.
        // Para obtener TODOS los ítems listados, necesitarías agregar una función al contrato
        // que itere sobre los tokenIds o mantenga un array de IDs listados.
        //
        // POR AHORA, para que los botones de compra aparezcan, usaremos el NFT ID 0
        // y lo agregaremos dinámicamente si está listado.
        
        const item = await marketplaceContract.listedItems(0); // Accede al mapeo del NFT ID 0
        
        if (item.isListed) {
            const tokenId = item.tokenId.toString();
            const price = ethers.utils.formatUnits(item.price, 18);
            const seller = item.seller;
            
            // Crear el elemento HTML para el NFT
            const nftCard = `
                <div class="nft-card">
                    <h3>NFT #${tokenId}</h3>
                    <p>Precio: ${price} MTK</p>
                    <p>Vendedor: ${seller.substring(0, 6)}...${seller.substring(seller.length - 4)}</p>
                    <button class="buy-button" onclick="buyNFT(${tokenId}, '${price}')">
                        Comprar
                    </button>
                </div>
            `;
            marketplaceContainer.innerHTML += nftCard;
            addLog(`✅ NFT ID ${tokenId} (listado) añadido al marketplace dinámicamente.`);
        } else {
            marketplaceContainer.innerHTML += '<p>No hay NFTs listados en este momento (excepto el de prueba si lo listarás).</p>';
            addLog(`🔄 No hay NFTs listados dinámicamente en el marketplace.`);
        }
        
    } catch (error) {
        addLog(`❌ Error al cargar los ítems del marketplace: ${error.message || error.code}`);
        console.error("Error al cargar los ítems del marketplace:", error);
        marketplaceContainer.innerHTML += '<p>Error al cargar los NFTs.</p>';
    }
}

// ======================================================================================
// 4. FUNCIONES PARA INTERACTUAR CON LOS CONTRATOS (TRANSACCIONES)
// ======================================================================================

// Función para listar el NFT de prueba (ID 0)
async function listNFT() {
    if (!signer) {
        alert("Por favor, conecta tu billetera primero.");
        return;
    }

    const tokenId = 0;
    
    addLog(`⏳ Intentando listar NFT ID ${tokenId} por ${LISTING_PRICE} MTK...`);
    
    try {
        // Primero, aprobar el contrato Marketplace para que pueda transferir el NFT
        addLog(`⏳ Aprobando Marketplace para transferir NFT ID ${tokenId}...`);
        const approveTx = await myNFTContract.approve(MARKETPLACE_ADDRESS, tokenId);
        await approveTx.wait();
        addLog("✅ Marketplace aprobado. La transacción de aprobación se ha confirmado.");
        
        // Ahora, listar el NFT en el Marketplace
        addLog(`⏳ Listando NFT en el Marketplace...`);
        const listTx = await marketplaceContract.listItem(tokenId, ethers.utils.parseUnits(LISTING_PRICE, 18));
        await listTx.wait();
        
        addLog(`🎉 NFT ID ${tokenId} listado exitosamente!`);
        await updateUI(); // Actualizar la interfaz
        await loadMarketplaceItems(); // Recargar los ítems del marketplace
    } catch (error) {
        addLog(`❌ Error al listar el NFT: ${error.message || error.code}`);
        console.error("Error al listar el NFT:", error);
        if (error.code === 4001) {
            alert("Transacción rechazada por el usuario.");
        } else {
            alert(`Ocurrió un error: ${error.message || error.reason || error.code}`);
        }
    }
}

// Función para comprar el NFT (¡VERSIÓN CORREGIDA!)
async function buyNFT(tokenId, price) {
    if (!signer) {
        alert("Por favor, conecta tu billetera primero.");
        return;
    }

    addLog(`⏳ Intentando comprar NFT ID ${tokenId} por ${price} MTK...`);
    
    try {
        // --- PARTE 1: APROBAR EL GASTO DE TOKENS ---
        const priceInWei = ethers.utils.parseUnits(price.toString(), 18);
        
        addLog(`⏳ Aprobando al Marketplace para gastar ${price} MTK...`);
        const approveTokenTx = await myTokenContract.approve(MARKETPLACE_ADDRESS, priceInWei);
        await approveTokenTx.wait();
        addLog("✅ Aprobación de tokens confirmada. La transacción se ha minado.");
        
        // --- PARTE 2: COMPRAR EL NFT ---
        // ¡Usamos buyItem y pasamos la dirección del token como se indica en el documento!
        addLog(`⏳ Ejecutando la compra del NFT ID ${tokenId} desde el marketplace...`);
        const buyTx = await marketplaceContract.buyItem(tokenId); // La función en Marketplace.sol es `buyItem`
        await buyTx.wait();
        
        addLog(`🎉 NFT ID ${tokenId} comprado exitosamente!`);
        alert(`¡Felicidades! Has comprado el NFT con ID ${tokenId}.`);
        
        // Cargar los NFTs nuevamente para actualizar la UI
        await loadMarketplaceItems();
        await updateUI(); 

    } catch (error) {
        addLog(`❌ Error al comprar el NFT: ${error.message || error.code}`);
        console.error("Error al comprar el NFT:", error);
        if (error.code === 4001) {
            alert("Transacción rechazada por el usuario.");
        } else {
            alert(`Ocurrió un error: ${error.message || error.reason || error.code}`);
        }
    }
}


// Función para cancelar el listado del NFT de prueba (ID 0)
async function cancelListing() {
    if (!signer) {
        alert("Por favor, conecta tu billetera primero.");
        return;
    }

    const tokenId = 0;
    
    addLog(`⏳ Intentando cancelar el listado para NFT ID ${tokenId}...`);
    
    try {
        const cancelTx = await marketplaceContract.cancelListing(tokenId);
        await cancelTx.wait();
        
        addLog(`🎉 Listado del NFT ID ${tokenId} cancelado exitosamente.`);
        await updateUI();
        await loadMarketplaceItems(); // Recargar los ítems del marketplace
    } catch (error) {
        addLog(`❌ Error al cancelar el listado: ${error.message || error.code}`);
        console.error("Error al cancelar el listado:", error);
        if (error.code === 4001) {
            alert("Transacción rechazada por el usuario.");
        } else {
            alert(`Ocurrió un error: ${error.message || error.reason || error.code}`);
        }
    }
}

// ======================================================================================
// 5. ESCUCHAR EVENTOS (según el documento)
// ======================================================================================

function listenToMarketplaceEvents() {
    // Escuchar el evento NFTListed
    marketplaceContract.on("NFTListed", (tokenId, seller, price, event) => {
        const formattedPrice = ethers.utils.formatUnits(price, 18);
        addLog(`🔔 Evento 'NFTListed': NFT ID ${tokenId} listado por ${seller.substring(0,6)}...${seller.substring(seller.length - 4)} por ${formattedPrice} MTK.`);
        updateUI(); // Actualiza la interfaz cuando ocurre un evento
        loadMarketplaceItems(); // Recargar ítems listados
    });
    
    // Escuchar el evento NFTBought
    marketplaceContract.on("NFTBought", (tokenId, buyer, price, event) => {
        const formattedPrice = ethers.utils.formatUnits(price, 18);
        addLog(`🔔 Evento 'NFTBought': NFT ID ${tokenId} comprado por ${buyer.substring(0,6)}...${buyer.substring(buyer.length - 4)} por ${formattedPrice} MTK.`);
        updateUI();
        loadMarketplaceItems();
    });
    
    // Escuchar el evento ListingCancelled
    marketplaceContract.on("ListingCancelled", (tokenId, seller, event) => {
        addLog(`🔔 Evento 'ListingCancelled': Listado de NFT ID ${tokenId} cancelado por ${seller.substring(0,6)}...${seller.substring(seller.length - 4)}.`);
        updateUI();
        loadMarketplaceItems();
    });
}

// ======================================================================================
// 6. INICIALIZACIÓN Y LISTENERS DE BOTONES
// ======================================================================================

// Cargar los ABIs al cargar la página
window.addEventListener('DOMContentLoaded', loadABIs);

// Escuchar el click en el botón de conectar
connectButton.addEventListener('click', connectWallet);

// Escuchar los clics en los botones de acción
listNftButton.addEventListener('click', listNFT);
// El botón de compra del NFT de prueba se manejará por la lógica de updateUI
// El buyNftButton global ya no se usa para un clic directo en el HTML,
// sino para el NFT ID 0 y los botones generados en loadMarketplaceItems
buyNftButton.addEventListener('click', () => buyNFT(0, LISTING_PRICE)); // Añadido para el botón específico del ID 0
cancelListingButton.addEventListener('click', cancelListing);

// Escuchar cambios de cuenta en MetaMask para actualizar la UI
if (window.ethereum) {
    window.ethereum.on('accountsChanged', async (accounts) => {
        if (accounts.length > 0) {
            // Si hay cuentas, obtenemos el nuevo signer y actualizamos
            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner(); // Esto obtiene el signer de la cuenta actualmente seleccionada
            addLog(`🔄 Cambio de cuenta a: ${accounts[0].substring(0,6)}...${accounts[0].substring(accounts[0].length - 4)}`);
            initializeContracts(); // Re-inicializar contratos con el nuevo signer
            await updateUI();
            await loadMarketplaceItems();
        } else {
            // Usuario se desconectó de la dApp
            addLog(`🔄 Usuario desconectado. Recargando la página...`);
            window.location.reload();
        }
    });
    // Escuchar cambio de red en MetaMask
    window.ethereum.on('chainChanged', (chainId) => {
        addLog(`🔄 Cambio de red a Chain ID: ${chainId}. Recargando la página...`);
        window.location.reload();
    });
}
