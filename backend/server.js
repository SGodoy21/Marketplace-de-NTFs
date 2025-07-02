// backend/server.js

// Importar las librerías necesarias
const express = require('express'); // Framework para crear el servidor web
const multer = require('multer');   // Middleware para manejar la subida de archivos (imágenes)
const axios = require('axios');     // Cliente HTTP para hacer solicitudes a la API de Pinata
const cors = require('cors');       // Middleware para permitir solicitudes de diferentes orígenes (frontend)
const FormData = require('form-data'); // Para construir el cuerpo de la solicitud multipart/form-data para Pinata
const path = require('path');       // Para manejar rutas de archivos

// ======================================================================================
// CONFIGURACIÓN DE PINATA IPFS (¡REEMPLAZA CON TUS CLAVES REALES!)
// ======================================================================================
// Es crucial que estas claves NO estén en tu frontend. Aquí en el backend están seguras.
// ¡IMPORTANTE! Reemplaza estos valores con tus propias claves de Pinata.
const PINATA_API_KEY = "e74576d46b7f65cea7ed";     
const PINATA_SECRET_API_KEY= "d959aaab847680ac7b8e43001cd9f0fa55687a5f436bd9df7a464f1c83d49626";  

// Inicializar la aplicación Express
const app = express();
const port = 3001; // Puerto para el servidor backend. Asegúrate de que no entre en conflicto con tu frontend (ej. 8000)

// Configurar multer para almacenar archivos en memoria temporalmente
const upload = multer({ storage: multer.memoryStorage() });

// Middlewares
app.use(cors()); // Habilitar CORS para que el frontend pueda comunicarse con este backend
app.use(express.json()); // Habilitar el parseo de JSON en las solicitudes

// ======================================================================================
// FUNCIÓN PARA SUBIR ARCHIVOS (BUFFER) A PINATA IPFS
// ======================================================================================
/**
 * Sube un buffer de archivo a Pinata IPFS.
 * @param {Buffer} fileBuffer El buffer del archivo a subir.
 * @param {string} fileName El nombre del archivo.
 * @returns {Promise<string>} El Hash IPFS (CID) del archivo subido.
 */
async function uploadBufferToPinata(fileBuffer, fileName) {
    try {
        const formData = new FormData();
        formData.append('file', fileBuffer, { filename: fileName });

        const pinataResponse = await axios.post(
            "https://api.pinata.cloud/pinning/pinFileToIPFS",
            formData,
            {
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
                    'pinata_api_key': PINATA_API_KEY,
                    'pinata_secret_api_key': PINATA_SECRET_API_KEY
                }
            }
        );

        if (pinataResponse.status !== 200) {
            console.error("Error Pinata response:", pinataResponse.data);
            throw new Error(`Failed to upload file to Pinata: ${pinataResponse.statusText} - ${JSON.stringify(pinataResponse.data)}`);
        }

        console.log(`✅ Archivo ${fileName} subido a Pinata! CID: ${pinataResponse.data.IpfsHash}`);
        return pinataResponse.data.IpfsHash; // Retorna solo el Hash IPFS (CID)
    } catch (error) {
        console.error("❌ Error uploading buffer to Pinata:", error.response ? error.response.data : error.message);
        throw new Error(`Error uploading buffer to Pinata: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
}

// ======================================================================================
// ENDPOINT PARA MINTAR NFT (RECIBE IMAGEN Y METADATOS)
// ======================================================================================
// Usamos `upload.single('image')` porque esperamos un solo archivo de imagen
app.post('/mint-nft', upload.single('image'), async (req, res) => {
    try {
        // 1. Validar que se recibió una imagen y otros datos
        if (!req.file) {
            return res.status(400).json({ error: "No se proporcionó archivo de imagen." });
        }
        const { name, description, rarity, price, creatorAddress } = req.body;

        if (!name || !description || !rarity || !price || !creatorAddress) {
            return res.status(400).json({ error: "Faltan metadatos del NFT (nombre, descripción, rareza, precio, dirección del creador)." });
        }

        console.log("Solicitud de minteo de NFT recibida:");
        console.log(`  Nombre: ${name}`);
        console.log(`  Descripción: ${description}`);
        console.log(`  Rareza: ${rarity}`);
        console.log(`  Precio: ${price}`);
        console.log(`  Creador: ${creatorAddress}`);
        console.log(`  Archivo de imagen: ${req.file.originalname} (${req.file.size} bytes)`);

        // 2. Subir la imagen a Pinata IPFS
        const imageIpfsHash = await uploadBufferToPinata(req.file.buffer, req.file.originalname);
        // CAMBIO CLAVE AQUÍ: La URL de la imagen en los metadatos será solo el CID de la imagen.
        const imageIpfsUrl = `ipfs://${imageIpfsHash}`; 

        // 3. Crear el objeto de metadatos JSON
        const nftMetadata = {
            name: name,
            description: description,
            image: imageIpfsUrl, // La URL IPFS de la imagen que acabamos de subir (solo CID)
            attributes: [
                {
                    trait_type: "Rareza",
                    value: rarity
                },
                {
                    trait_type: "Creador",
                    value: creatorAddress
                }
            ]
            // Puedes añadir más atributos aquí si lo deseas
        };

        // 4. Subir el JSON de metadatos a Pinata IPFS
        const metadataFileName = `metadata_${Date.now()}.json`; // Nombre único para el archivo JSON
        const metadataJsonBuffer = Buffer.from(JSON.stringify(nftMetadata));
        const metadataIpfsHash = await uploadBufferToPinata(metadataJsonBuffer, metadataFileName);
        
        // El finalTokenURI apunta al CID del JSON de metadatos.
        const finalTokenURI = `ipfs://${metadataIpfsHash}`; 

        console.log(`URI de Token Final para NFT: ${finalTokenURI}`);

        // 5. Devolver la URL IPFS final al frontend
        res.status(200).json({ tokenURI: finalTokenURI });

    } catch (error) {
        console.error("Error procesando solicitud de minteo de NFT:", error);
        res.status(500).json({ error: "Fallo al procesar solicitud de minteo de NFT: " + error.message });
    }
});

// ======================================================================================
// FUNCIÓN PARA PROBAR LA CONEXIÓN A PINATA
// ======================================================================================
async function testPinataConnection() {
    console.log("------------------------------------------");
    console.log("🧪 Probando conexión a Pinata...");
    try {
        // Intenta obtener los datos del usuario de Pinata. Es una llamada simple que requiere las claves.
        const response = await axios.get("https://api.pinata.cloud/data/testAuthentication", {
            headers: {
                'pinata_api_key': PINATA_API_KEY,
                'pinata_secret_api_key': PINATA_SECRET_API_KEY
            }
        });

        if (response.status === 200 && response.data.message === "Congratulations! You are communicating with the Pinata API!") {
            console.log("✅ Conexión a Pinata exitosa. Tus claves API son válidas.");
        } else {
            console.error("❌ Conexión a Pinata fallida. Respuesta inesperada:", response.data);
            console.error("   Asegúrate de que tus PINATA_API_KEY y PINATA_SECRET_API_KEY sean correctas.");
        }
    } catch (error) {
        console.error("❌ Error al intentar conectar con Pinata:");
        if (error.response) {
            // El servidor de Pinata respondió con un código de error
            console.error(`   Código de estado: ${error.response.status}`);
            console.error(`   Datos de error: ${JSON.stringify(error.response.data)}`);
            if (error.response.data && error.response.data.error && error.response.data.error.reason === "INVALID_API_KEYS") {
                console.error("   ¡ERROR: Tus claves API de Pinata son INVÁLIDAS o NO ENCONTRADAS!");
                console.error("   Por favor, verifica cuidadosamente PINATA_API_KEY y PINATA_SECRET_API_KEY en backend/server.js.");
                console.error("   Asegúrate de que no haya espacios extra o caracteres incorrectos.");
            }
        } else if (error.request) {
            // La solicitud fue hecha pero no se recibió respuesta (ej. problema de red)
            console.error("   No se recibió respuesta del servidor de Pinata. ¿Problema de red o firewall?");
        } else {
            // Algo más causó el error
            console.error(`   Error: ${error.message}`);
        }
    }
    console.log("------------------------------------------");
}


// Iniciar el servidor
app.listen(port, () => {
    console.log(`🚀 Servidor backend corriendo en http://localhost:${port}`);
    console.log(`   - Endpoint para minteo: POST /mint-nft`);
    console.log(`   - Recuerda reemplazar YOUR_PINATA_API_KEY y YOUR_PINATA_SECRET_API_KEY con tus claves reales.`);
    testPinataConnection(); // Llama a la función de prueba de conexión al iniciar el servidor
});
