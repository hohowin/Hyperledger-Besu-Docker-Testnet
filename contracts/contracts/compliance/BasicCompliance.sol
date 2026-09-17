// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IModularCompliance.sol";

/// @notice MVP compliance module (D-01, deliverables DL-2.1): no additional
/// restriction beyond the IdentityRegistry verified-status check the Token
/// already performs. Exists as a real module — not a stub the Token
/// special-cases — so country-restriction / max-holder-count modules (FR-15)
/// can be swapped in later by binding a different ModularCompliance
/// implementation, with no change to Token.
contract BasicCompliance is IModularCompliance, Ownable {
    address public boundToken;

    event TokenBound(address indexed token);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function bindToken(address token) external onlyOwner {
        require(token != address(0), "BasicCompliance: zero address");
        boundToken = token;
        emit TokenBound(token);
    }

    function canTransfer(address /* from */, address /* to */, uint256 /* amount */) external pure returns (bool) {
        return true;
    }

    function transferred(address /* from */, address /* to */, uint256 /* amount */) external {}
}
