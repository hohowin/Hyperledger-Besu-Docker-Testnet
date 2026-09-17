// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IdentityRegistryStorage.sol";
import "./ClaimTopicsRegistry.sol";
import "./TrustedIssuersRegistry.sol";

/// @notice Trimmed T-REX IdentityRegistry (D-03): the access-controlled front
/// door onboarding services and the Token call. Two roles are modeled
/// distinctly even though a single Admin wallet holds both in v1 (D-02,
/// plan.md §2): the contract owner acts as TokenAgent (register/remove), and
/// registry-listed TrustedIssuers (checked per call) issue claims. Splitting
/// either role to a different wallet later needs no redeploy of this contract.
contract IdentityRegistry is Ownable {
    IdentityRegistryStorage public immutable identityStorage;
    ClaimTopicsRegistry public immutable claimTopics;
    TrustedIssuersRegistry public immutable trustedIssuers;

    event IdentityRegistered(address indexed wallet, address indexed agent);
    event IdentityRemoved(address indexed wallet, address indexed agent);
    event ClaimIssued(address indexed wallet, uint256 indexed topic, address indexed issuer);

    constructor(
        address initialOwner,
        address identityStorage_,
        address claimTopics_,
        address trustedIssuers_
    ) Ownable(initialOwner) {
        identityStorage = IdentityRegistryStorage(identityStorage_);
        claimTopics = ClaimTopicsRegistry(claimTopics_);
        trustedIssuers = TrustedIssuersRegistry(trustedIssuers_);
    }

    /// @notice TokenAgent action (US-003): onboard a wallet as a registered
    /// identity. Idempotent — registering an already-registered address is a
    /// no-op, not a revert, so the onboarding flow is safe to retry from the UI.
    function registerIdentity(address wallet) external onlyOwner {
        if (identityStorage.isRegistered(wallet)) {
            return;
        }
        identityStorage.registerIdentity(wallet);
        emit IdentityRegistered(wallet, msg.sender);
    }

    function removeIdentity(address wallet) external onlyOwner {
        identityStorage.removeIdentity(wallet);
        emit IdentityRemoved(wallet, msg.sender);
    }

    /// @notice TrustedIssuer action (US-004): issue a claim for a required
    /// topic. Reverts if the wallet is not registered, the topic is not
    /// required, or the caller is not a trusted issuer for that topic.
    function issueClaim(address wallet, uint256 topic) external {
        require(identityStorage.isRegistered(wallet), "IdentityRegistry: wallet not registered");
        require(claimTopics.isClaimTopicRequired(topic), "IdentityRegistry: topic not required");
        require(
            trustedIssuers.isTrustedIssuerForTopic(msg.sender, topic),
            "IdentityRegistry: caller not a trusted issuer for topic"
        );
        identityStorage.setClaim(wallet, topic, true);
        emit ClaimIssued(wallet, topic, msg.sender);
    }

    /// @notice The single compliance predicate the Token relies on: a wallet
    /// is verified once it is registered and holds every required claim topic.
    function isVerified(address wallet) external view returns (bool) {
        if (!identityStorage.isRegistered(wallet)) {
            return false;
        }
        uint256[] memory topics = claimTopics.getClaimTopics();
        for (uint256 i = 0; i < topics.length; i++) {
            if (!identityStorage.hasClaim(wallet, topics[i])) {
                return false;
            }
        }
        return true;
    }

    function isRegistered(address wallet) external view returns (bool) {
        return identityStorage.isRegistered(wallet);
    }
}
