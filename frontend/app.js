// Direcciones de los contratos desplegados (¡ACTUALIZA ESTAS DIRECCIONES CON LAS DE TU ÚLTIMO DESPLIEGUE!)
// ¡IMPORTANTE! Asegúrate de que estas direcciones coincidan con las de tu último despliegue de Hardhat.
const MY_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // ¡ACTUALIZADO SEGÚN TU IMAGEN!
const MY_NFT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";   // ¡ACTUALIZADO SEGÚN TU IMAGEN!
const MARKETPLACE_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"; // ¡ACTUALIZADO SEGÚN TU IMAGEN!
const LISTING_PRICE_DEFAULT = "100"; // Precio por defecto para listar, en MTK (100 MTK)
const DEFAULT_TOKEN_URI_BASE = "https://example.com/metadata?name="; // Base URI para metadatos simples

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

let mintNftSection; // La sección completa de minteo
let mintFormContainer; // El div que contiene el formulario de minteo
let mintForm; // El formulario en sí
let nftNameInput; // Input para el nombre del NFT
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
    logList.prepend(li);
}

// ---------- Cargar ABIs (archivos JSON en el mismo folder)
async function loadABIs() {
    try {
        const [tokenRes, nftRes, marketplaceRes] = await Promise.all([
            fetch('MyToken.json'),
            fetch('MyNFT.json'),
            fetch('Marketplace.json'),
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
        console.error("DEBUG: initializeContracts: El proveedor es nulo.");
        return;
    }
    if (!signer) {
        addLog("❌ No hay firmante para inicializar contratos.", 'error');
        console.error("DEBUG: initializeContracts: El firmante es nulo.");
        return;
    }

    // Inicializar instancias de contratos
    myTokenContract = new ethers.Contract(MY_TOKEN_ADDRESS, MyTokenABI.abi, signer);
    myNFTContract = new ethers.Contract(MY_NFT_ADDRESS, MyNFTABI.abi, signer);
    marketplaceContract = new ethers.Contract(MARKETPLACE_ADDRESS, MarketplaceABI.abi, signer);

    addLog("✅ Contratos inicializados.", 'success');

    // Eliminar todos los listeners anteriores para evitar duplicados al re-inicializar
    if (marketplaceContract) {
        marketplaceContract.removeAllListeners();
        marketplaceContract.hasListeners = false; // Restablecer la bandera
    }
    if (myTokenContract) {
        myTokenContract.removeAllListeners();
    }

    // Adjuntar nuevos listeners
    if (!marketplaceContract.hasListeners) {
        listenToMarketplaceEvents();
        marketplaceContract.hasListeners = true; // Marcar que los listeners ya están adjuntos
    }

    // Adjuntar listener para el evento 'Transfer' de MyToken
    myTokenContract.on("Transfer", async (from, to, value) => {
        addLog(`🔔 Evento 'Transfer' de MTK: De ${from.slice(0,6)}... a ${to.slice(0,6)}... valor ${ethers.utils.formatUnits(value, 18)} MTK.`, 'info');
        // Si la cuenta actual está involucrada en la transferencia (como remitente o receptor), actualizar la UI
        if (currentAccount && (from.toLowerCase() === currentAccount.toLowerCase() || to.toLowerCase() === currentAccount.toLowerCase())) {
            console.log(`DEBUG: Evento Transferencia involucra la cuenta actual (${currentAccount}), actualizando UI.`);
            await updateUI();
        }
    });
    addLog("✅ Listener de eventos 'Transfer' de MyToken activado.", 'success');

    console.log("DEBUG: initializeContracts: Contratos inicializados y listeners adjuntos.");
}

// ---------- Conectar billetera MetaMask
async function connectWallet() {
    console.log("DEBUG: connectWallet: Función connectWallet llamada.");
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
        console.log("DEBUG: connectWallet: Firmante después de la asignación:", signer);

        initializeContracts(); // Inicializar contratos con el nuevo signer

        // Hacer visibles las secciones de NFT del usuario y minteo eliminando la clase 'hidden'
        if (mintNftSection) mintNftSection.classList.remove('hidden');
        if (userNftsCollectionSection) userNftsCollectionSection.classList.remove('hidden');


        await updateUI();
        await loadUserNFTs();
        // NOTA: loadMarketplaceItems() NO se llama aquí para evitar la carga automática del marketplace.
        // Se cargará solo cuando el usuario haga clic en el botón "Recargar Marketplace".

        addLog("✅ Billetera conectada.", 'success');
        console.log("DEBUG: connectWallet: Conexión exitosa y UI actualizada.");
    } catch (e) {
        addLog("❌ Error conectando billetera: " + e.message, 'error');
        console.error("DEBUG: connectWallet: Error en la conexión:", e);
        if (addNetworkButton) {
            addNetworkButton.style.display = 'block';
        }
        if (connectButton) {
            connectButton.textContent = "Conectar Billetera";
            connectButton.disabled = false;
        }
    }
}

// ---------- Mostrar/ocultar formulario de minteo
function toggleMintFormVisibility() {
    if (mintFormContainer) { // Asegurarse de que el contenedor exista
        mintFormContainer.classList.toggle('hidden'); // Usa la clase 'hidden' de Tailwind
        if (!mintFormContainer.classList.contains('hidden')) {
            // Si se muestra el formulario, limpiar inputs y enfocar el primero
            if (nftNameInput) nftNameInput.value = '';
            if (nftPriceInput) nftPriceInput.value = LISTING_PRICE_DEFAULT;
            if (nftNameInput) nftNameInput.focus();
        }
    }
}

// ---------- Mintear NFT con formulario
async function createAndMintNFT(e) { // Renombrado para mayor claridad, y recibe el evento
    e.preventDefault(); // Previene el envío del formulario por defecto

    if (!signer || !currentAccount) {
        alert("Conecta tu billetera primero.");
        addLog("❌ No hay firmante o cuenta para mintear NFT.", 'error');
        return;
    }
    if (!myNFTContract) {
        addLog("❌ Contrato MyNFT no inicializado para mintear.", 'error');
        return;
    }

    const name = nftNameInput.value.trim(); // Usar nftNameInput
    const price = nftPriceInput.value.trim(); // Usar nftPriceInput

    if (!name) { // Solo requerir el nombre
        alert("Por favor, introduce un nombre para el NFT.");
        return;
    }

    try {
        addLog(`⏳ Minteando NFT '${name}'...`, 'info');

        // Deshabilitar botones del formulario
        if (createNftButton) {
            createNftButton.disabled = true;
            createNftButton.textContent = "Creando...";
        }
        if (cancelMintButton) {
            cancelMintButton.disabled = true;
        }

        // Construye un URI simple con el nombre del NFT. NO sube a IPFS.
        const tokenURI = `${DEFAULT_TOKEN_URI_BASE}${encodeURIComponent(name)}`;
        console.log(`DEBUG: Minteando con tokenURI: ${tokenURI}`); // Log para verificar el URI

        const tx = await myNFTContract.safeMint(currentAccount, tokenURI, { gasLimit: 300000 });
        const receipt = await tx.wait(); // Esperar el recibo para obtener el tokenId

        // Extraer el tokenId del evento Transfer
        let tokenId = null;
        for (const event of receipt.events) {
            if (event.event === "Transfer") {
                // El evento Transfer tiene from, to, tokenId
                // Asegúrate de que sea el evento de tu NFT (from es 0x0 para minteo)
                if (event.args.from === ethers.constants.AddressZero) {
                    tokenId = event.args.tokenId.toString();
                    break;
                }
            }
            // Si el evento Transfer no es el de minteo, puede ser otro evento, lo ignoramos.
        }

        if (tokenId) {
            // Almacenar el precio de minteo asociado a este tokenId
            mintedNftPrices[tokenId] = price;
            addLog(`🎉 NFT '${name}' (ID: ${tokenId}) minteado exitosamente! Precio de listado guardado: ${price} MTK.`, 'success');
            alert(`NFT '${name}' (ID: ${tokenId}) minteado directamente a tu billetera.`);
        } else {
            addLog(`🎉 NFT '${name}' minteado exitosamente, pero no se pudo obtener el ID.`, 'success');
            alert(`NFT '${name}' minteado directamente a tu billetera.`);
        }


        // Limpiar formulario y ocultarlo
        if (mintFormContainer) mintFormContainer.classList.add('hidden');
        if (nftNameInput) nftNameInput.value = '';
        if (nftPriceInput) nftPriceInput.value = LISTING_PRICE_DEFAULT; // Resetear al valor por defecto

        await updateUI();
        await loadUserNFTs(); // Recargar los NFTs del usuario para ver el nuevo
        // NOTA: loadMarketplaceItems() NO se llama aquí para evitar la carga automática del marketplace.
    } catch (error) {
        addLog("❌ Error minteando NFT: " + (error.message || error.code), 'error');
        alert("Error minteando NFT: " + (error.message || error.code));
        console.error(error);
    } finally {
        // Re-habilitar botones del formulario
        if (createNftButton) {
            createNftButton.disabled = false;
            createNftButton.textContent = "Crear NFT";
        }
        if (cancelMintButton) {
            cancelMintButton.disabled = false;
        }
    }
}

// ---------- Actualizar UI (balance y estado general)
async function updateUI() {
    console.log("DEBUG: updateUI: Función updateUI llamada.");
    if (!signer || !currentAccount) {
        addLog("ℹ️ No hay firmante o cuenta para actualizar la UI.", 'info');
        return;
    }

    try {
        if (!myTokenContract) {
            addLog("❌ Contrato MyToken no inicializado para actualizar el balance.", 'error');
            console.error("DEBUG: updateUI: myTokenContract es nulo.");
            if (mtkBalanceSpan) mtkBalanceSpan.textContent = "Error";
            return;
        }
        const balance = await myTokenContract.balanceOf(currentAccount);
        if (mtkBalanceSpan) mtkBalanceSpan.textContent = parseFloat(ethers.utils.formatUnits(balance, 18)).toFixed(2);
        addLog(`✅ Balance de MTK actualizado: ${mtkBalanceSpan ? mtkBalanceSpan.textContent : 'N/A'}`, 'success');
    } catch (e) {
        addLog("❌ Error actualizando balance: " + e.message, 'error'); // Añadido log para errores
        console.error("DEBUG: Error actualizando balance:", e);
    }
}

// ---------- Cargar NFTs del usuario
async function loadUserNFTs() {
    if (isUserNFTsLoading) {
        console.warn("DEBUG: loadUserNFTs: Ya se está cargando, previniendo re-entrada.");
        return; // Prevenir re-entrada
    }
    isUserNFTsLoading = true;
    console.log("DEBUG: loadUserNFTs: Iniciando llamada a la función.");

    if (!signer || !currentAccount) {
        addLog("ℹ️ No hay firmante o cuenta para cargar los NFTs del usuario.", 'info');
        console.log("DEBUG: loadUserNFTs: No hay firmante o currentAccount. Saliendo.");
        isUserNFTsLoading = false;
        return;
    }

    if (!userNftsGrid || !userNftsCountSpan) {
        addLog("❌ Error: Elementos DOM de NFT de usuario no encontrados.", 'error');
        console.error("DEBUG-USER-NFT: ERROR: Elemento #user-nfts-grid o #user-nfts-count no encontrado en HTML.");
        isUserNFTsLoading = false;
        return;
    }

    try {
        if (!myNFTContract) {
            addLog("❌ Contrato MyNFT no inicializado para cargar los NFTs del usuario.", 'error');
            console.error("DEBUG: loadUserNFTs: myNFTContract es nulo.");
            userNftsCountSpan.textContent = "Error";
            userNftsGrid.innerHTML = '<p class="text-gray-400">Error cargando tus NFTs.</p>';
            isUserNFTsLoading = false;
            return;
        }
        if (!marketplaceContract) {
            addLog("❌ Contrato del Marketplace no inicializado para verificar el estado de listado de NFTs.", 'error');
            console.warn("DEBUG-USER-NFT: marketplaceContract es nulo. No se puede verificar el estado de listado.");
        }

        const balance = await myNFTContract.balanceOf(currentAccount);
        userNftsCountSpan.textContent = balance.toString();
        userNftsGrid.innerHTML = ''; // Limpiar la cuadrícula antes de añadir nuevos elementos
        console.log(`DEBUG-USER-NFT: userNftsGrid limpiado. Balance reportado por el contrato: ${balance.toString()}`);

        if (balance.eq(0)) {
            userNftsGrid.innerHTML = '<p class="text-gray-400">No tienes NFTs en tu billetera. ¡Mintea uno!</p>';
            addLog("🔄 No tienes NFTs en tu billetera.", 'info');
            console.log("DEBUG-USER-NFT: El balance es 0. Mostrando mensaje de no NFTs.");
            isUserNFTsLoading = false;
            return;
        }

        const uniqueTokenIdsRendered = new Set(); // Para detectar duplicados de renderizado reales
        for (let i = 0; i < balance.toNumber(); i++) {
            const tokenId = (await myNFTContract.tokenOfOwnerByIndex(currentAccount, i)).toString();
            console.log(`DEBUG-USER-NFT: Iteración del bucle ${i}, tokenId obtenido: ${tokenId}`);

            if (uniqueTokenIdsRendered.has(tokenId)) {
                console.warn(`DEBUG-USER-NFT: ADVERTENCIA: Intentando renderizar tokenId duplicado ${tokenId} en la misma llamada a loadUserNFTs.`);
                // Esto indicaría un problema con el contrato o el entorno Hardhat si tokenOfOwnerByIndex devuelve duplicados.
                continue; // Saltar para evitar la duplicación visual si esto ocurre.
            }
            uniqueTokenIdsRendered.add(tokenId);

            // Obtener el tokenURI para extraer el nombre
            let nftName = `NFT #${tokenId}`; // Nombre por defecto
            try {
                const tokenURI = await myNFTContract.tokenURI(tokenId);
                console.log(`DEBUG-USER-NFT: TokenURI para NFT ID ${tokenId}: ${tokenURI}`);
                if (tokenURI.startsWith(DEFAULT_TOKEN_URI_BASE)) {
                    const urlParams = new URLSearchParams(tokenURI.split('?')[1]);
                    const nameFromUri = urlParams.get('name');
                    if (nameFromUri) {
                        nftName = decodeURIComponent(nameFromUri);
                    }
                }
            } catch (uriError) {
                console.warn(`DEBUG-USER-NFT: Error obteniendo o parseando tokenURI para NFT ID ${tokenId}: ${uriError.message}`);
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
                    console.log(`DEBUG-USER-NFT: NFT ID ${tokenId} - isListed: ${isListed}, Precio: ${listedPrice}, Vendedor: ${listedSeller}`);
                } catch (marketplaceError) {
                    console.warn(`DEBUG-USER-NFT: Error obteniendo el estado de listado para NFT ID ${tokenId}: ${marketplaceError.message}`);
                    isListed = false;
                }
            }

            let buttonHTML;
            let statusText;
            // Usar el precio guardado en mintedNftPrices si existe, de lo contrario el default
            const priceForListing = mintedNftPrices[tokenId] || LISTING_PRICE_DEFAULT;

            if (isListed && listedSeller.toLowerCase() === currentAccount.toLowerCase()) {
                buttonHTML = `<button class="btn danger-btn" onclick="cancelListing(${tokenId})">Cancelar Listado</button>`;
                statusText = `Listado por ti por ${listedPrice} MTK`;
            } else if (isListed && listedSeller.toLowerCase() !== currentAccount.toLowerCase()) {
                // Este caso no debería ocurrir para NFTs en la billetera del usuario,
                // ya que no poseerían un NFT listado por otra persona.
                buttonHTML = `<span class="text-gray-400 text-sm italic">Listado por otro (${listedSeller.slice(0,6)}...)</span>`;
                statusText = `Listado por ${listedSeller.slice(0,6)}... por ${listedPrice} MTK`;
            } else {
                buttonHTML = `<button class="btn success-btn" onclick="listNFT(${tokenId}, ${priceForListing})">Listar por ${priceForListing} MTK</button>`;
                statusText = "No listado";
            }

            const div = document.createElement('div');
            div.className = 'nft-card';
            div.innerHTML = `
                <h3>${nftName} (#${tokenId})</h3>
                <p>Estado: <span class="highlight">${statusText}</span></p>
                ${buttonHTML}
            `;
            userNftsGrid.appendChild(div);
            console.log(`DEBUG-USER-NFT: Tarjeta añadida para NFT ID: ${tokenId}`);
        }
        addLog(`✅ NFTs del usuario cargados. Total: ${balance.toString()}`, 'success');
        console.log("DEBUG: loadUserNFTs: Función terminada exitosamente.");
    } catch (e) {
        addLog("❌ Error cargando NFTs del usuario: " + e.message, 'error');
        console.error("DEBUG: Error cargando NFTs del usuario:", e);
        userNftsGrid.innerHTML = '<p class="text-gray-400">Error cargando tus NFTs.</p>';
    } finally {
        isUserNFTsLoading = false; // Resetear bandera
        console.log("DEBUG: loadUserNFTs: Función finalizada, bandera reseteada.");
    }
}

// ---------- Listar NFT
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
        await loadMarketplaceItems(); // Recargar el marketplace para mostrar el nuevo NFT listado
    } catch (error) {
        addLog("❌ Error listando NFT: " + (error.message || error.code), 'error');
        alert("Error listando NFT: " + (error.message || error.code));
        console.error(error);
    } finally {
        document.querySelectorAll('.nft-card .btn').forEach(btn => btn.disabled = false);
        if (listAllUserNftsButton) listAllUserNftsButton.disabled = false;
    }
}

// ---------- Comprar NFT
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
        document.querySelectorAll('.nft-card .btn').forEach(btn => btn.disabled = false);
        if (listAllUserNftsButton) listAllUserNftsButton.disabled = false;
    }
}

// ---------- Cancelar listado NFT
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
        document.querySelectorAll('.nft-card .btn').forEach(btn => btn.disabled = false);
        if (listAllUserNftsButton) listAllUserNftsButton.disabled = false;
    }
}

// ---------- Cargar NFTs listados en el marketplace
async function loadMarketplaceItems() {
    if (isMarketplaceLoading) {
        console.warn("DEBUG-LMI: Ya se está cargando, previniendo re-entrada.");
        return; // Prevenir re-entrada
    }
    isMarketplaceLoading = true;
    addLog("Cargando ítems del marketplace...", 'info');
    console.log("DEBUG-LMI: Iniciando función loadMarketplaceItems.");
    
    let marketplaceGrid = document.getElementById('marketplace-grid'); // Obtener directamente por ID
    if (!marketplaceGrid) {
        addLog("❌ Error: Contenedor del Marketplace (ID 'marketplace-grid') no encontrado.", 'error');
        console.error("DEBUG-LMI: ERROR: Elemento #marketplace-grid no encontrado en HTML.");
        isMarketplaceLoading = false;
        return;
    }
    
    // Limpiar el contenido de la cuadrícula antes de cargar nuevos ítems para evitar duplicación
    marketplaceGrid.innerHTML = '<p class="text-gray-400">Cargando ítems...</p>';
    console.log("DEBUG-LMI: Contenido del Marketplace limpiado.");

    if (!signer || !marketplaceContract || !myNFTContract) { // Added myNFTContract check
        marketplaceGrid.innerHTML = '<p class="text-gray-400">Marketplace no disponible o billetera no conectada.</p>';
        addLog("❌ Marketplace no disponible o billetera no conectada para cargar ítems.", 'error');
        console.error("DEBUG-LMI: Signer, marketplaceContract, o myNFTContract es nulo.");
        isMarketplaceLoading = false;
        return;
    }

    try {
        console.log("DEBUG-LMI: Intentando obtener IDs listados del contrato.");
        const tokenIdsBN = await marketplaceContract.getListedTokenIds();
        const tokenIds = tokenIdsBN.map(bn => bn.toNumber());
        marketplaceGrid.innerHTML = ''; // Limpiar de nuevo después de obtener los IDs, antes de añadir tarjetas

        if (tokenIds.length === 0) {
            marketplaceGrid.innerHTML = '<p class="text-gray-400">No hay NFTs listados en este momento.</p>';
            addLog(`🔄 No hay NFTs listados en el marketplace.`, 'info');
            isMarketplaceLoading = false;
            return;
        }

        console.log("DEBUG-LMI: Iterando sobre IDs listados para renderizar.");
        for (let tokenId of tokenIds) {
            const item = await marketplaceContract.listedItems(tokenId);
            if (!item.isListed) {
                addLog(`ℹ️ NFT ID ${tokenId} encontrado en la lista de IDs pero no está listado.`, 'info');
                continue;
            }

            const seller = item.seller;
            const priceMTK = ethers.utils.formatUnits(item.price, 18);

            // Obtener el tokenURI para extraer el nombre
            let nftName = `NFT #${tokenId}`; // Nombre por defecto
            try {
                const tokenURI = await myNFTContract.tokenURI(tokenId);
                console.log(`DEBUG-LMI: TokenURI para NFT ID ${tokenId}: ${tokenURI}`);
                if (tokenURI.startsWith(DEFAULT_TOKEN_URI_BASE)) {
                    const urlParams = new URLSearchParams(tokenURI.split('?')[1]);
                    const nameFromUri = urlParams.get('name');
                    if (nameFromUri) {
                        nftName = decodeURIComponent(nameFromUri);
                    }
                }
            } catch (uriError) {
                console.warn(`DEBUG-LMI: Error obteniendo o parseando tokenURI para NFT ID ${tokenId}: ${uriError.message}`);
            }

            let buttonHTML;
            if (currentAccount && seller.toLowerCase() === currentAccount.toLowerCase()) {
                // Si el NFT pertenece a la cuenta conectada actualmente
                buttonHTML = `<button class="btn danger-btn" onclick="cancelListing(${tokenId})">Cancelar Listado</button>`;
            } else {
                // Si el NFT pertenece a otra cuenta
                buttonHTML = `<button class="btn info-btn" onclick="buyNFT(${tokenId}, '${priceMTK}')">Comprar</button>`;
            }

            const card = document.createElement('div');
            card.className = 'nft-card';
            card.innerHTML = `
                <h3>${nftName} (#${tokenId})</h3>
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
        isMarketplaceLoading = false; // Resetear bandera
        console.log("DEBUG-LMI: Función finalizada, bandera reseteada.");
    }
}

// ---------- Listar todos los NFTs del usuario si no están listados
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

        for (let i = 0; i < balance.toNumber(); i++) {
            const tokenId = await myNFTContract.tokenOfOwnerByIndex(currentAccount, i);
            const item = await marketplaceContract.listedItems(tokenId);
            if (!item.isListed) {
                // Usar el precio guardado en mintedNftPrices si existe, de lo contrario el default
                const priceToUse = mintedNftPrices[tokenId.toString()] || LISTING_PRICE_DEFAULT;
                addLog(`⏳ Listando NFT ID ${tokenId} con precio ${priceToUse} MTK...`, 'info');
                await listNFT(tokenId.toString(), priceToUse);
                listedCount++;
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
        await loadMarketplaceItems(); // Recargar el marketplace después de listar todos los NFTs
    }
}

// ---------- Eventos del marketplace para actualizar UI
function listenToMarketplaceEvents() {
    if (marketplaceContract) {
        // Eliminar listeners anteriores para evitar duplicados
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
        console.warn("DEBUG: No se pudieron adjuntar los listeners de eventos: marketplaceContract es nulo.");
    }
}

// ---------- Añadir red Hardhat a MetaMask
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

// ---------- Detectar cambio de cuenta y actualizar todo
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

        const marketplaceGrid = document.getElementById('marketplace-grid');
        const userNftsGridElement = userNftsGrid;

        if (marketplaceGrid) marketplaceGrid.innerHTML = '<p class="text-gray-400">Cargando ítems...</p>';
        if (userNftsGridElement) userNftsGridElement.innerHTML = '<p class="text-gray-400">Cargando tus NFTs...</p>';

        initializeContracts();

        if (mintNftSection) mintNftSection.classList.remove('hidden');
        if (userNftsCollectionSection) userNftsCollectionSection.classList.remove('hidden');

        await updateUI();
        await loadUserNFTs();
        // NOTA: loadMarketplaceItems() NO se llama aquí para evitar la carga automática del marketplace.
        addLog(`✅ UI actualizada para la cuenta: ${currentAccount.slice(0,6)}...`, 'success');
    });

    window.ethereum.on('chainChanged', (chainId) => {
        addLog(`🔄 Red cambiada a Chain ID: ${chainId}. Recargando página...`, 'info');
        window.location.reload();
    });
}

// ---------- Carga inicial de la aplicación cuando el DOM está listo
window.addEventListener('DOMContentLoaded', async () => {
    // Obtener referencias a los elementos DOM aquí, cuando se garantiza que existen.
    connectButton = document.getElementById('connect-button');
    connectStatus = document.getElementById('connect-status');
    accountAddress = document.getElementById('account-address');
    mtkBalanceSpan = document.getElementById('mtk-balance');
    logList = document.getElementById('log-list');
    marketplaceContainer = document.getElementById('marketplace-container');

    mintNftSection = document.getElementById('mint-nft-section');
    mintFormContainer = document.getElementById('mint-form-container');
    mintForm = document.getElementById('mint-form');
    nftNameInput = document.getElementById('nft-name');
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

    await loadABIs();

    if (connectButton) connectButton.addEventListener('click', connectWallet);
    
    if (addNetworkButton) addNetworkButton.addEventListener('click', addHardhatNetwork);
    if (loadMarketplaceButton) loadMarketplaceButton.addEventListener('click', loadMarketplaceItems);
    if (listAllUserNftsButton) listAllUserNftsButton.addEventListener('click', async () => {
        addLog("🔘 Listando todos los NFTs del usuario no listados...", 'info');
        await listAllUserNFTsIfNotListed();
    });

    if (toggleMintFormButton) toggleMintFormButton.addEventListener('click', toggleMintFormVisibility);
    if (mintForm) mintForm.addEventListener('submit', createAndMintNFT);
    if (cancelMintButton) cancelMintButton.addEventListener('click', toggleMintFormVisibility);

});


// ---------- Funciones expuestas globalmente para botones dinámicos (onclick en HTML)
window.listNFT = listNFT;
window.buyNFT = buyNFT;
window.cancelListing = cancelListing;
