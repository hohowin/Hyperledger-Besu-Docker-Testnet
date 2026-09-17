// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IdentityRegistry.sol";
import "./compliance/IModularCompliance.sol";

/// @notice Trimmed T-REX Token (D-01, D-12): "Digital Asset Token" (DAT).
/// This is the actual compliance boundary (architecture.md §6/§10) — transfers
/// revert for any unverified sender/recipient regardless of who calls the
/// contract or how, so the guarantee can't be bypassed by skipping the
/// backend. Minting also requires the recipient to already be verified
/// (architecture.md §8: "claim requires registration, mint requires
/// verification" are both enforced on-chain, not just orchestrated off-chain).
contract Token is ERC20, Ownable {
    IdentityRegistry public immutable identityRegistry;
    IModularCompliance public immutable compliance;

    constructor(
        address initialOwner,
        address identityRegistry_,
        address compliance_
    ) ERC20("Coin", "COIN") Ownable(initialOwner) {
        identityRegistry = IdentityRegistry(identityRegistry_);
        compliance = IModularCompliance(compliance_);
    }

    /// @notice TokenAgent action (US-005): mint to a verified identity only.
    function mint(address to, uint256 amount) external onlyOwner {
        require(identityRegistry.isVerified(to), "Token: recipient not verified");
        _mint(to, amount);
    }

    /// @dev OZ v5 unified transfer hook. from == address(0) is a mint,
    /// to == address(0) is a burn; neither is in scope for v1 (D-20), but the
    /// checks are structured so mint still goes through the verified-to gate
    /// above rather than bypassing it here.
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            require(identityRegistry.isVerified(from), "Token: sender not verified");
            require(identityRegistry.isVerified(to), "Token: recipient not verified");
            require(compliance.canTransfer(from, to, value), "Token: compliance check failed");
        }

        super._update(from, to, value);

        if (from != address(0) && to != address(0)) {
            compliance.transferred(from, to, value);
        }
    }
}
