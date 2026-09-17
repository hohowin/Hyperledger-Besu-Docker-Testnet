// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Trimmed T-REX IdentityRegistryStorage (D-03): raw per-wallet
/// identity state. No per-investor OnchainID proxy — the wallet address
/// itself is the identity key. Only the bound IdentityRegistry contract may
/// mutate state; the owner (Admin) may rebind it once after deployment.
contract IdentityRegistryStorage is Ownable {
    struct Identity {
        bool registered;
        mapping(uint256 => bool) claims; // topic => issued
    }

    address public boundIdentityRegistry;
    mapping(address => Identity) private _identities;

    event IdentityRegistryBound(address indexed identityRegistry);
    event IdentityRegistered(address indexed wallet);
    event IdentityRemoved(address indexed wallet);
    event ClaimSet(address indexed wallet, uint256 indexed topic, bool issued);

    modifier onlyBoundRegistry() {
        require(msg.sender == boundIdentityRegistry, "IdentityRegistryStorage: caller is not the bound registry");
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    function bindIdentityRegistry(address identityRegistry) external onlyOwner {
        require(identityRegistry != address(0), "IdentityRegistryStorage: zero address");
        boundIdentityRegistry = identityRegistry;
        emit IdentityRegistryBound(identityRegistry);
    }

    function registerIdentity(address wallet) external onlyBoundRegistry {
        require(!_identities[wallet].registered, "IdentityRegistryStorage: already registered");
        _identities[wallet].registered = true;
        emit IdentityRegistered(wallet);
    }

    function removeIdentity(address wallet) external onlyBoundRegistry {
        require(_identities[wallet].registered, "IdentityRegistryStorage: not registered");
        delete _identities[wallet];
        emit IdentityRemoved(wallet);
    }

    function setClaim(address wallet, uint256 topic, bool issued) external onlyBoundRegistry {
        require(_identities[wallet].registered, "IdentityRegistryStorage: not registered");
        _identities[wallet].claims[topic] = issued;
        emit ClaimSet(wallet, topic, issued);
    }

    function isRegistered(address wallet) external view returns (bool) {
        return _identities[wallet].registered;
    }

    function hasClaim(address wallet, uint256 topic) external view returns (bool) {
        return _identities[wallet].claims[topic];
    }
}
