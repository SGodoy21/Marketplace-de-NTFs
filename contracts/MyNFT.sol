// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/**
 * @title MyNFT
 * @dev An ERC721 contract for our NFT Marketplace.
 * This contract allows for minting new NFTs with a specific URI.
 */
contract MyNFT is ERC721URIStorage, Ownable {
    // Use a simple uint256 as a counter.
    // We use unchecked to avoid overflow checks and save gas,
    // as we don't expect the number of NFTs to overflow uint256.
    uint256 private _tokenIdCounter;

    /**
     * @dev Constructor that sets the name and symbol for the NFT collection.
     */
    constructor() ERC721("MarketplaceNFT", "MNFT") Ownable(msg.sender) {}

    /**
     * @dev Mints a new NFT and assigns it to the minter.
     * @param _to The address to mint the NFT to.
     * @param _tokenURI The URI pointing to the metadata of the NFT.
     */
    function safeMint(address _to, string memory _tokenURI) public onlyOwner {
        // Get the current token ID and then increment it.
        uint256 tokenId = _tokenIdCounter;
        unchecked {
            _tokenIdCounter++;
        }

        // Mint the NFT.
        _safeMint(_to, tokenId);

        // Set the token URI.
        _setTokenURI(tokenId, _tokenURI);
    }
}

