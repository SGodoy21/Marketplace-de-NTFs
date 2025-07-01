// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

/**
 * @title MyNFT
 * @dev An ERC721 contract for our NFT Marketplace.
 * This contract allows for minting new NFTs with a specific URI.
 */
contract MyNFT is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable {
    // Use a simple uint256 as a counter.
    uint256 private _tokenIdCounter;

    /**
     * @dev Constructor that sets the name and symbol for the NFT collection.
     */
    constructor()
        ERC721("MarketplaceNFT", "MNFT")
        Ownable(msg.sender)
    {}

    /**
     * @dev Mints a new NFT and assigns it to the minter.
     * Public function allowing any user to mint NFTs.
     * @param _to The address to mint the NFT to.
     * @param _tokenURI The URI pointing to the metadata of the NFT.
     */
    function safeMint(address _to, string memory _tokenURI) public {
        uint256 tokenId = _tokenIdCounter;
        unchecked {
            _tokenIdCounter++;
        }

        _safeMint(_to, tokenId);
        _setTokenURI(tokenId, _tokenURI);
    }

    // --- REQUIRED OVERRIDES FOR MULTIPLE INHERITANCE ---

    /**
     * @dev Override required by Solidity for multiple inheritance.
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Override required by Solidity for multiple inheritance.
     */
    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    /**
     * @dev Override required by Solidity for multiple inheritance.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    /**
     * @dev Override required by Solidity for multiple inheritance.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}