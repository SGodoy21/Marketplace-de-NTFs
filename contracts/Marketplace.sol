// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./MyNFT.sol";
import "./MyToken.sol";
/**
 * @title Marketplace
 * @dev A smart contract for an NFT marketplace.
 * Allows users to list, buy, and cancel the listing of NFTs.
 */
contract Marketplace is Ownable {
    // State variables to store the contracts
    MyNFT public nftContract;
    MyToken public tokenContract;

    // Struct to represent a listed item
    struct ListedItem {
        uint256 tokenId;
        address seller;
        uint256 price;
        bool isListed;
    }

    // Mapping from tokenId to its ListedItem details
    mapping(uint256 => ListedItem) public listedItems;

    // Events to be emitted for frontend
    event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event NFTBought(uint256 indexed tokenId, address indexed buyer, uint256 price);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);

    /**
     * @dev Constructor to set the addresses of the NFT and token contracts.
     * @param _nftContractAddress The address of the deployed NFT contract.
     * @param _tokenContractAddress The address of the deployed ERC20 token contract.
     */
    constructor(address _nftContractAddress, address _tokenContractAddress) Ownable(msg.sender) {
        nftContract = MyNFT(_nftContractAddress);
        tokenContract = MyToken(_tokenContractAddress);
    }

    /**
     * @dev Lists an NFT for sale.
     * The NFT must first be approved to be transferred by this contract.
     * @param _tokenId The ID of the NFT to list.
     * @param _price The price in ERC20 tokens.
     */
    function listItem(uint256 _tokenId, uint256 _price) public {
        require(!listedItems[_tokenId].isListed, "Item already listed");
        require(_price > 0, "Price must be greater than 0");

        // Ensure the seller owns the NFT
        require(nftContract.ownerOf(_tokenId) == msg.sender, "You do not own this NFT");
        
        // Ensure the marketplace contract is approved to transfer the NFT
        require(nftContract.getApproved(_tokenId) == address(this), "Marketplace must be approved to transfer NFT");
        
        // Transfer the NFT from the seller to the marketplace contract
        nftContract.transferFrom(msg.sender, address(this), _tokenId);

        // Add the item to the listed items mapping
        listedItems[_tokenId] = ListedItem(_tokenId, msg.sender, _price, true);

        // Emit the event
        emit NFTListed(_tokenId, msg.sender, _price);
    }

    /**
     * @dev Allows a user to buy a listed NFT.
     * @param _tokenId The ID of the NFT to buy.
     */
    function buyItem(uint256 _tokenId) public {
        ListedItem storage item = listedItems[_tokenId];
        require(item.isListed, "Item is not listed");
        require(item.seller != msg.sender, "Cannot buy your own item");

        // Transfer ERC20 tokens from the buyer to the seller
        tokenContract.transferFrom(msg.sender, item.seller, item.price);
        
        // Transfer the NFT from the marketplace to the buyer
        nftContract.transferFrom(address(this), msg.sender, _tokenId);

        // Mark the item as not listed
        delete listedItems[_tokenId];

        // Emit the event
        emit NFTBought(_tokenId, msg.sender, item.price);
    }

    /**
     * @dev Allows the seller to cancel a listed item.
     * @param _tokenId The ID of the NFT to cancel the listing for.
     */
    function cancelListing(uint256 _tokenId) public {
        ListedItem storage item = listedItems[_tokenId];
        require(item.isListed, "Item is not listed");
        require(item.seller == msg.sender, "You are not the seller");

        // Transfer the NFT back to the seller
        nftContract.transferFrom(address(this), msg.sender, _tokenId);

        // Remove the item from the listed items mapping
        delete listedItems[_tokenId];

        // Emit the event
        emit ListingCancelled(_tokenId, msg.sender);
    }
}