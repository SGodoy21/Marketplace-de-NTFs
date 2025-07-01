const fs = require('fs');
const path = require('path');

// Contratos que querés copiar
const contracts = ['MyToken', 'MyNFT', 'Marketplace'];

// Ruta base desde Hardhat (donde están los ABI generados)
const artifactsDir = path.join(__dirname, 'artifacts', 'contracts');

// Ruta de destino (carpeta del frontend)
const frontendDir = path.join(__dirname, 'frontend');

for (const name of contracts) {
    const contractPath = path.join(artifactsDir, `${name}.sol`, `${name}.json`);
    const targetPath = path.join(frontendDir, `${name}.json`);

    try {
        if (!fs.existsSync(contractPath)) {
            console.error(`❌ No se encontró el ABI de ${name} en ${contractPath}`);
            continue;
        }

        fs.copyFileSync(contractPath, targetPath);
        console.log(`✅ ABI de ${name} copiado a ${targetPath}`);
    } catch (err) {
        console.error(`❌ Error copiando ABI de ${name}:`, err.message);
    }
}
