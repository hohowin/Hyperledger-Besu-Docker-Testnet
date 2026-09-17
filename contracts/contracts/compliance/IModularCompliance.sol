// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Interface the Token calls on every transfer, independent of the
/// IdentityRegistry verified-status check. Kept modular per D-01 so future
/// rules (country restriction, max-holder-count — FR-15, deferred) can be
/// added as new modules without changing Token.
interface IModularCompliance {
    function canTransfer(address from, address to, uint256 amount) external view returns (bool);
    function transferred(address from, address to, uint256 amount) external;
}
