// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MyToken
 * @dev A simple ERC20 token for our NFT Marketplace.
 * This token can be used to pay for NFTs.
 */
contract MyToken is ERC20, Ownable {
    /**
     * @dev Constructor that mints an initial supply of tokens to the deployer.
     * @param initialSupply The amount of tokens to mint initially.
     */
    constructor(uint256 initialSupply) ERC20("MarketplaceToken", "MTK") Ownable(msg.sender) {
        // Mint the initial supply to the deployer of the contract.
        _mint(msg.sender, initialSupply);
    }
}