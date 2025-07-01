// Direcciones de los contratos desplegados
const MY_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; 
const MY_NFT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";   
const MARKETPLACE_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"; 
const LISTING_PRICE_DEFAULT = "100"; // Precio por defecto para listar, en MTK (100 MTK)

const DEFAULT_TOKEN_URI = "https://example.com/my-nft-metadata.json"; // URI por defecto para mintear


// ABIs de los contratos (se cargan desde los archivos JSON)
let MyTokenABI;
let MyNFTABI;
let MarketplaceABI;

// Instancias de Ethers.js (serán re-inicializadas en cada cambio de cuenta)
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
const logList = document.getElementById('log-list');
const marketplaceContainer = document.getElementById("marketplace-container");

// Elementos para la sección de Minteo
const mintNftSection = document.getElementById('mint-nft-section');
const mintButton = document.getElementById('mint-button');

// Elementos para la sección de NFTs del usuario (¡NUEVA Y DINÁMICA!)
const userNftsCollectionSection = document.getElementById('user-nfts-collection-section');
const userNftsGrid = document.getElementById('user-nfts-grid');
const nftOwnerCount = document.getElementById('nft-owner');

// Botón para añadir la red
const addNetworkButton = document.getElementById('add-network-button');

// Función para añadir logs a la interfaz
function addLog(message, type = '') { 
    const listItem = document.createElement('li');
    listItem.textContent = message;
    if (type) {
        listItem.classList.add(type);
    }
    logList.prepend(listItem); 
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
        
        addLog("✅ ABIs de contratos cargados correctamente.", 'success');
    } catch (error) {
        addLog(`❌ Error al cargar los ABI: ${error.message}`, 'error');
        console.error("Error al cargar los ABI:", error);
    }
}

// ======================================================================================
// 1. CONEXIÓN A LA BILLETERA (METAMASK) y Gestión de Red
// ======================================================================================

async function connectWallet() {
    try {
        if (!window.ethereum) {
            alert('¡MetaMask no está instalado! Instálalo para usar esta dApp.');
            return;
        }

        provider = new ethers.providers.Web3Provider(window.ethereum);
        
        // Solicitar cuentas
        await provider.send("eth_requestAccounts", []);
        
        signer = provider.getSigner();
        const address = await signer.getAddress();
        
        connectStatus.textContent = "Conectado";
        connectStatus.classList.remove('status-disconnected'); 
        connectStatus.classList.add('status-connected');    

        accountAddress.textContent = address;
        connectButton.textContent = "Conectado";
        connectButton.disabled = true;
        if (addNetworkButton) addNetworkButton.style.display = 'none';
        
        addLog(`✅ Billetera conectada: ${address}`, 'success');

        initializeContracts(); // Re-inicializar contratos con el nuevo signer
        
        await updateUI();
        await loadUserNFTs(); 
        
    } catch (error) {
        addLog(`❌ Error al conectar: ${error.message}`, 'error');
        console.error("Error al conectar la billetera:", error);
        if (addNetworkButton) addNetworkButton.style.display = 'block';
    }
}

// Función para sugerir añadir la red Hardhat/Ganache a MetaMask
async function addHardhatNetwork() {
    if (!window.ethereum) {
        alert('MetaMask no está instalado. No se puede añadir la red.');
        return;
    }

    try {
        await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
                chainId: '0x7A69', // ID de cadena predeterminado de Hardhat Network (31337 en decimal)
                chainName: 'Hardhat Localhost',
                nativeCurrency: {
                    name: 'Ether',
                    symbol: 'ETH',
                    decimals: 18
                },
                rpcUrls: ['http://127.0.0.1:8545'], // Asegúrate de que esta sea la URL correcta de tu Hardhat/Ganache
                blockExplorerUrls: [''], 
            }],
        });
        addLog("✅ Red Hardhat añadida a MetaMask.", 'success');
        alert("Red Hardhat añadida a MetaMask. Por favor, conéctate a ella.");
    } catch (error) {
        addLog(`❌ Error al añadir la red: ${error.message}`, 'error');
        console.error("Error al añadir la red:", error);
    }
}


// ======================================================================================
// 2. INICIALIZAR INSTANCIAS DE CONTRATOS (Re-inicializar en cada cambio de cuenta)
// ======================================================================================

function initializeContracts() {
  if (!signer) {
    addLog("❌ Error: Signer no disponible para inicializar contratos. Intenta conectar la billetera.", 'error');
    return;
  }
  myTokenContract = new ethers.Contract(MY_TOKEN_ADDRESS, MyTokenABI.abi, signer);
  myNFTContract = new ethers.Contract(MY_NFT_ADDRESS, MyNFTABI.abi, signer);
  marketplaceContract = new ethers.Contract(MARKETPLACE_ADDRESS, MarketplaceABI.abi, signer);

  addLog("✅ Instancias de contratos inicializadas/actualizadas.", 'success');

  // Antes de añadir listeners, eliminar listeners antiguos para evitar duplicados
  marketplaceContract.removeAllListeners();
  listenToMarketplaceEvents();
}

// ======================================================================================
// 3. LEER DATOS DESDE LA BLOCKCHAIN Y ACTUALIZAR UI (General y Dinámica)
// ======================================================================================

async function updateUI() {
    try {
        if (!signer) { // Si no hay billetera conectada, restablecer la UI
            connectStatus.textContent = "Desconectado";
            connectStatus.classList.remove('status-connected'); 
            connectStatus.classList.add('status-disconnected');    
            accountAddress.textContent = "N/A";
            mtkBalanceSpan.textContent = "0";
            if (mintNftSection) mintNftSection.style.display = 'none';
            if (userNftsCollectionSection) userNftsCollectionSection.style.display = 'none';
            connectButton.textContent = "Conectar Billetera";
            connectButton.disabled = false;
            addNetworkButton.style.display = 'block'; 
            return;
        }

        const userAddress = await signer.getAddress();
        addLog(`DEBUG-UI: userAddress: ${userAddress.substring(0, 10)}...`, 'info');
        
        const balanceWei = await myTokenContract.balanceOf(userAddress);
        const balanceMTK = ethers.utils.formatUnits(balanceWei, 18);
        mtkBalanceSpan.textContent = parseFloat(balanceMTK).toFixed(2);
        addLog(`Actualizando balance: ${balanceMTK} MTK para ${userAddress.substring(0,6)}...${userAddress.substring(userAddress.length - 4)}`, 'info');

        // Mostrar las secciones relevantes si hay un signer
        if (mintNftSection) mintNftSection.style.display = 'block';
        if (userNftsCollectionSection) userNftsCollectionSection.style.display = 'block'; 

    } catch (error) {
        addLog(`❌ Error al actualizar la UI general: ${error.message || error.code}`, 'error');
        console.error("Error al actualizar la UI general:", error);
    }
}

/**
 * @dev Carga y renderiza todos los NFTs que la billetera conectada posee.
 */
async function loadUserNFTs() {
  console.log("DEBUG-USER-NFT: Inicio de loadUserNFTs.");

  try {
    const userAddress = await signer.getAddress();
    const balance = await myNFTContract.balanceOf(userAddress);
    console.log("DEBUG-USER-NFT: balanceOf user:", balance.toString());

    // Limpiar grid para evitar duplicados
    userNftsGrid.innerHTML = '';

    for (let i = 0; i < balance; i++) {
      const tokenId = await myNFTContract.tokenOfOwnerByIndex(userAddress, i);

      // Render simple sin imágenes ni tokenURI
      const card = document.createElement("div");
      card.className = "nft-card";
      card.textContent = `NFT ID: ${tokenId.toString()}`;

      // Botones para listar o cancelar, si querés luego los agregamos
      userNftsGrid.appendChild(card);
    }

    nftOwnerCount.textContent = balance.toString();

  } catch (error) {
    console.error("DEBUG-USER-NFT: Error al cargar NFTs del usuario:", error);
  }

  console.log("DEBUG-USER-NFT: Fin de loadUserNFTs.");
}



/**
 * @dev Fetches and renders the NFTs available for sale in the marketplace.
 */
async function loadMarketplaceItems() {
  try {
    const listedIdsRaw = await marketplaceContract.getListedTokenIds();
    const uniqueListedIds = [...new Set(listedIdsRaw.map(id => id.toNumber()))];

    // Limpiar container para evitar duplicados
    marketplaceContainer.innerHTML = '';
    
   for (let tokenId of uniqueListedIds) {
        const item = await marketplaceContract.listedItems(tokenId);
        if (!item.isListed) continue;

        await renderMarketplaceCard({ 
            tokenId: tokenId.toString(), 
            price: item.price, 
            seller: item.seller 
        });
    }

  } catch (error) {
    console.error("Error cargando ítems del marketplace:", error);
  }
}

// ======================================================================================
// FUNCIONES PARA INTERACTUAR CON LOS CONTRATOS (TRANSACCIONES)
// ======================================================================================

// Función para mintear un nuevo NFT (ahora accesible desde el botón)
async function mintNFT() {
    if (!signer) {
        alert("Por favor, conecta tu billetera primero.");
        return;
    }
    addLog("⏳ Intentando mintear un nuevo NFT...", 'info');
    mintButton.disabled = true; 
    mintButton.textContent = "Minteando...";
    try {
        const userAddress = await signer.getAddress();
        const mintTx = await myNFTContract.safeMint(userAddress, DEFAULT_TOKEN_URI, { gasLimit: 300000 }); 
        
        addLog("⏳ Esperando confirmación de minteo...", 'info');
        await mintTx.wait();
        
        addLog("🎉 ¡Nuevo NFT minteado exitosamente!", 'success');
        alert("¡Felicidades! Has minteado un nuevo NFT.");
        
        await updateUI();
        //await loadMarketplaceItems(); 
        await loadUserNFTs(); 
    } catch (error) {
        addLog(`❌ Error al mintear NFT: ${error.message || error.code}`, 'error');
        console.error("Error al mintear NFT:", error);
        if (error.code === 4001) {
            alert("Transacción rechazada por el usuario.");
        } else {
            alert(`Ocurrió un error inesperado al mintear: ${error.message || error.reason || error.code}`);
        }
    } finally {
        mintButton.disabled = false;
        mintButton.textContent = "Mintear Nuevo NFT";
    }
}

// Función para listar todos los NFTs del usuario si no están listados
async function listAllUserNFTsIfNotListed() {
    try {
        const userAddress = await signer.getAddress();
        const balance = await myNFTContract.balanceOf(userAddress);

        const promises = [];

        for (let i = 0; i < balance; i++) {
            const tokenId = await myNFTContract.tokenOfOwnerByIndex(userAddress, i);
            const item = await marketplaceContract.listedItems(tokenId);

            if (!item.isListed) {
                promises.push(listNFT(tokenId, LISTING_PRICE_DEFAULT));
            } else {
                console.log(`NFT ID ${tokenId} ya está listado.`);
            }
        }

        // Esperar a que todos los listados se completen en paralelo
        await Promise.all(promises);
    } catch (error) {
        console.error("Error al intentar listar todos los NFTs del usuario:", error);
        addLog(`❌ Error al listar NFTs del usuario: ${error.message || error.code}`, 'error');
    }
}


// Función para listar un NFT (ahora toma un tokenId y el precio)
async function listNFT(tokenId, price) {
    console.log(`DEBUG INICIO: Función listNFT ha sido llamada para NFT ID ${tokenId}.`); 
    if (!signer) {
        alert("Por favor, conecta tu billetera primero.");
        return;
    }
    
    addLog(`⏳ Intentando listar NFT ID ${tokenId} por ${price} MTK...`, 'info');
    
    try {
        // Deshabilitar todos los botones de listar/cancelar para evitar clicks múltiples
        document.querySelectorAll('.nft-card .btn').forEach(btn => btn.disabled = true);

        addLog(`⏳ Aprobando Marketplace para transferir NFT ID ${tokenId}...`, 'info');
        const approveTx = await myNFTContract.approve(MARKETPLACE_ADDRESS, tokenId, { gasLimit: 300000 }); 
        addLog("⏳ Esperando confirmación de aprobación del NFT...", 'info');
        await approveTx.wait();
        addLog("✅ Marketplace aprobado para transferir NFT. La transacción de aprobación se ha confirmado.", 'success');
        
        addLog(`⏳ Listando NFT en el Marketplace...`, 'info');
        const listTx = await marketplaceContract.listItem(tokenId, ethers.utils.parseUnits(price.toString(), 18), { gasLimit: 300000 }); 
        addLog("⏳ Esperando confirmación de listado...", 'info');
        await listTx.wait();
        
        addLog(`🎉 NFT ID ${tokenId} listado exitosamente!`, 'success');
        alert(`¡Felicidades! Has listado el NFT con ID ${tokenId}.`);

        await updateUI(); 
        //await loadMarketplaceItems(); 
        await loadUserNFTs(); 
    } catch (error) {
        console.error(`DEBUG: Error al listar el NFT ID ${tokenId}:`, error);
        addLog(`❌ Error al listar el NFT ID ${tokenId}: ${error.message || error.code}`, 'error');
        
        if (error.code === 4001) {
            alert("Transacción rechazada por el usuario en MetaMask.");
        } else if (error.reason && error.reason.includes("Marketplace must be approved to transfer NFT")) {
            alert("El Marketplace no está aprobado para transferir el NFT. Asegúrate de haber aprobado el token.");
        } else if (error.reason && error.reason.includes("ERC721: approve caller is not token owner or approved for all")) {
             alert("Error de aprobación: No eres el propietario del NFT o no has aprobado al Marketplace. Asegúrate de que el NFT está en tu billetera.");
        } else if (error.reason && error.reason.includes("Item already listed")) {
             alert("Este NFT ya está listado en el marketplace.");
        } else {
            alert(`Ocurrió un error inesperado al listar: ${error.message || error.reason || error.code}`);
        }
    } finally { 
        // ¡IMPORTANTE! Re-habilitar los botones solo después de que se refresque la UI
        // La UI se refresca al final, así que esto puede ser redundante o innecesario aquí.
        // Pero lo mantenemos si hay un retraso en updateUI/loadUserNFTs
        document.querySelectorAll('.nft-card .btn').forEach(btn => btn.disabled = false); 
    }
}

// Función para comprar un NFT
async function buyNFT(tokenId, price) {
  if (!signer) {
    alert("Por favor, conecta tu billetera primero.");
    return;
  }

  try {
    const buyer = await signer.getAddress();
    const item = await marketplaceContract.listedItems(tokenId);

    if (buyer.toLowerCase() === item.seller.toLowerCase()) {
      alert("No podés comprar tu propio NFT.");
      return;
    }

    addLog(`⏳ Intentando comprar NFT ID ${tokenId} por ${price} MTK...`, 'info');
    document.querySelectorAll('.nft-card .btn').forEach(btn => btn.disabled = true);

    const priceInWei = ethers.utils.parseUnits(price.toString(), 18);
    const approveTokenTx = await myTokenContract.approve(MARKETPLACE_ADDRESS, priceInWei);
    await approveTokenTx.wait();

    const buyTx = await marketplaceContract.buyItem(tokenId);
    await buyTx.wait();

    addLog(`🎉 NFT ID ${tokenId} comprado exitosamente!`, 'success');

    await loadMarketplaceItems();
    await updateUI();
    await loadUserNFTs();
    await refreshBalance();

  } catch (error) {
    console.error("Error al comprar el NFT:", error);
    alert(`Error al comprar el NFT: ${error.message || error.reason || error.code}`);
  } finally {
    document.querySelectorAll('.nft-card .btn').forEach(btn => btn.disabled = false);
  }
}

// Función para cancelar el listado de un NFT (ahora toma un tokenId)
async function cancelListing(tokenId) { 
    if (!signer) {
        alert("Por favor, conecta tu billetera primero.");
        return;
    }

    addLog(`⏳ Intentando cancelar el listado para NFT ID ${tokenId}...`, 'info');
    
    try {
        // Deshabilitar todos los botones de listar/cancelar para evitar clicks múltiples
        document.querySelectorAll('.nft-card .btn').forEach(btn => btn.disabled = true);

        const cancelTx = await marketplaceContract.cancelListing(tokenId);
        await cancelTx.wait();
        
        addLog(`🎉 Listado del NFT ID ${tokenId} cancelado exitosamente.`, 'success');
        alert(`¡Listado del NFT ID ${tokenId} cancelado exitosamente!`);
        await updateUI();
        await loadMarketplaceItems(); 
        await loadUserNFTs();
    } catch (error) {
        addLog(`❌ Error al cancelar el listado: ${error.message || error.code}`, 'error');
        console.error("Error al cancelar el listado:", error);
        if (error.code === 4001) {
            alert("Transacción rechazada por el usuario.");
        } else if (error.reason && error.reason.includes("Item is not listed")) {
            alert("Este NFT no está listado.");
        } else if (error.reason && error.reason.includes("You are not the seller")) {
            alert("No eres el vendedor de este NFT.");
        } else {
            alert(`Ocurrió un error: ${error.message || error.reason || error.code}`);
        }
    } finally {
        // ¡IMPORTANTE! Re-habilitar los botones solo después de que se refresque la UI
        document.querySelectorAll('.nft-card .btn').forEach(btn => btn.disabled = false);
    }
}

// ======================================================================================
// 5. ESCUCHAR EVENTOS (Refrescar la UI en cada evento relevante)
// ======================================================================================
function listenToMarketplaceEvents() {
  marketplaceContract.on("NFTListed", async (tokenId, seller, price) => {
    addLog(`🔔 NFT ID ${tokenId} listado por ${seller}`, 'info');
    await updateUI();
    // No cargar automáticamente marketplace para que no se liste solo
  });

  marketplaceContract.on("NFTBought", async (tokenId, buyer, price) => {
    addLog(`🔔 NFT ID ${tokenId} comprado por ${buyer}`, 'success');
    await updateUI();
  });

  marketplaceContract.on("ListingCancelled", async (tokenId, seller) => {
    addLog(`🔔 Listado de NFT ID ${tokenId} cancelado por ${seller}`, 'info');
    await updateUI();
  });

  addLog("✅ Listeners de eventos configurados.", 'success');
}


// ======================================================================================
// 6. INICIALIZACIÓN Y LISTENERS DE BOTONES
// ======================================================================================

window.addEventListener('DOMContentLoaded', loadABIs); 

if (connectButton) connectButton.addEventListener('click', connectWallet);
if (mintButton) mintButton.addEventListener('click', mintNFT);
if (addNetworkButton) addNetworkButton.addEventListener('click', addHardhatNetwork);

// ¡IMPORTANTE! Eliminamos los listeners obsoletos de los botones estáticos de la antigua sección.
// La interacción ahora se maneja directamente en los botones generados dinámicamente en loadUserNFTs().
/*
listNftButton.addEventListener('click', async () => { ... }); 
buyNftButton.addEventListener('click', () => buyNFT(0, LISTING_PRICE)); 
cancelListingButton.addEventListener('click', cancelListing); 
*/

if (window.ethereum) {
  window.ethereum.on('accountsChanged', async (accounts) => {
    addLog(`🔄 Cambio de cuenta detectado: ${accounts[0]}`, 'info');

    if (accounts.length > 0) {
      provider = new ethers.providers.Web3Provider(window.ethereum);
      signer = provider.getSigner();

      // Limpiar contenedores para evitar duplicados
      userNftsGrid.innerHTML = '';
      marketplaceContainer.innerHTML = '';

      initializeContracts();

      accountAddress.textContent = accounts[0];
      await updateUI();
      await loadUserNFTs();
      // NO cargar marketplace automáticamente, sólo bajo demanda con botón
    } else {
      addLog("⚠️ Cuenta desconectada. Recargando...", 'warning');
      window.location.reload();
    }
  });
}

const loadMarketplaceButton = document.getElementById('load-marketplace-button');
if (loadMarketplaceButton) {
    loadMarketplaceButton.addEventListener('click', async () => {
        await loadMarketplaceItems();
    });
}

const listNftButton = document.getElementById("list-nft-button");
if (listNftButton) {
    listNftButton.addEventListener("click", async () => {
        addLog("🔘 Botón presionado: listando NFTs si no están listados...", "info");
        await listAllUserNFTsIfNotListed();
        await updateUI();
        await loadUserNFTs();
        await loadMarketplaceItems();
    });
}

// Refrescar el balance MTK después de eventos importantes
async function refreshBalance() {
    try {
        if (!signer) return;
        const userAddress = await signer.getAddress();
        const balanceWei = await myTokenContract.balanceOf(userAddress);
        const balanceMTK = ethers.utils.formatUnits(balanceWei, 18);
        mtkBalanceSpan.textContent = parseFloat(balanceMTK).toFixed(2);
    } catch (err) {
        console.error("Error actualizando balance:", err);
    }
}

/**
 * Renderiza una card para un NFT listado en el Marketplace.
 */
async function renderMarketplaceCard({ tokenId, price, seller }) {
  const card = document.createElement("div");
  card.className = "nft-card";

  const userAddress = await signer.getAddress();

  const priceFormatted = ethers.utils.formatUnits(price, 18);

  // Mostrar botón distinto según propietario vs usuario conectado
 let buttonHTML = '';
 if (seller.toLowerCase() === userAddress.toLowerCase()) {
   buttonHTML = `<button class="btn btn-cancelar" onclick="cancelListing(${tokenId})">Cancelar listado</button>`;
 } else {
   buttonHTML = `<button class="btn btn-comprar" onclick="buyNFT(${tokenId}, '${priceFormatted}')">Comprar</button>`;
 }


  card.innerHTML = `
    <p><strong>ID:</strong> ${tokenId}</p>
    <p><strong>Precio:</strong> ${priceFormatted} MTK</p>
    <p><strong>Vendedor:</strong> ${seller.substring(0,6)}...${seller.substring(seller.length - 4)}</p>
    ${buttonHTML}
  `;

  marketplaceContainer.appendChild(card);
}


