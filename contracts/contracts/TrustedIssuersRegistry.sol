// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Trimmed T-REX TrustedIssuersRegistry (D-03): which addresses are
/// allowed to issue claims for which topics. MVP has exactly one trusted
/// issuer — the Admin wallet, playing the TrustedIssuer role per D-02 —
/// but the contract models issuer/topic as a many-to-many relationship so a
/// second issuer or topic can be added later without a schema change.
contract TrustedIssuersRegistry is Ownable {
    mapping(address => mapping(uint256 => bool)) private _issuerTopics;
    mapping(address => bool) private _isTrustedIssuer;
    address[] private _issuers;

    event TrustedIssuerAdded(address indexed issuer, uint256 indexed topic);
    event TrustedIssuerRemoved(address indexed issuer, uint256 indexed topic);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function addTrustedIssuer(address issuer, uint256 topic) external onlyOwner {
        require(issuer != address(0), "TrustedIssuersRegistry: zero address");
        if (!_isTrustedIssuer[issuer]) {
            _isTrustedIssuer[issuer] = true;
            _issuers.push(issuer);
        }
        _issuerTopics[issuer][topic] = true;
        emit TrustedIssuerAdded(issuer, topic);
    }

    function removeTrustedIssuer(address issuer, uint256 topic) external onlyOwner {
        _issuerTopics[issuer][topic] = false;
        emit TrustedIssuerRemoved(issuer, topic);
    }

    function isTrustedIssuerForTopic(address issuer, uint256 topic) external view returns (bool) {
        return _issuerTopics[issuer][topic];
    }

    function getTrustedIssuers() external view returns (address[] memory) {
        return _issuers;
    }
}
