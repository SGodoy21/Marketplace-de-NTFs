const { ethers } = require("hardhat");

async function main() {
  // Define la cantidad de tokens que se acuñarán inicialmente.
  // 1000 tokens con 18 decimales.
  const initialSupply = ethers.parseUnits("1000", 18);

  console.log("Deploying MyToken contract...");

  // Obtenemos la fábrica del contrato MyToken
  const MyToken = await ethers.getContractFactory("MyToken");

  // Desplegamos el contrato, pasando el suministro inicial al constructor.
  const myToken = await MyToken.deploy(initialSupply);

  // Esperamos a que el despliegue se complete.
  await myToken.waitForDeployment();

  // Obtenemos la dirección del contrato desplegado
  const tokenAddress = await myToken.getAddress();

  console.log(`MyToken contract deployed to address: ${tokenAddress}`);

  // Opcional: Imprimimos el balance del deployer para verificar.
  const [deployer] = await ethers.getSigners();
  const balance = await myToken.balanceOf(deployer.address);
  console.log(`Balance of deployer (${deployer.address}): ${ethers.formatUnits(balance, 18)} MTK`);
}

// Se recomienda usar este patrón para manejar errores
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });