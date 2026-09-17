// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Trimmed T-REX ClaimTopicsRegistry (D-03): the set of claim topics
/// an identity must hold to be considered verified. MVP ships a single topic
/// (KYC); additional topics can be added without redeploying (FR-15 hook).
contract ClaimTopicsRegistry is Ownable {
    uint256 public constant KYC_TOPIC = 1;

    uint256[] private _topics;
    mapping(uint256 => bool) private _topicExists;

    event ClaimTopicAdded(uint256 indexed topic);
    event ClaimTopicRemoved(uint256 indexed topic);

    constructor(address initialOwner) Ownable(initialOwner) {
        _addTopic(KYC_TOPIC);
    }

    function addClaimTopic(uint256 topic) external onlyOwner {
        _addTopic(topic);
    }

    function removeClaimTopic(uint256 topic) external onlyOwner {
        require(_topicExists[topic], "ClaimTopicsRegistry: topic not set");
        _topicExists[topic] = false;
        uint256 len = _topics.length;
        for (uint256 i = 0; i < len; i++) {
            if (_topics[i] == topic) {
                _topics[i] = _topics[len - 1];
                _topics.pop();
                break;
            }
        }
        emit ClaimTopicRemoved(topic);
    }

    function getClaimTopics() external view returns (uint256[] memory) {
        return _topics;
    }

    function isClaimTopicRequired(uint256 topic) external view returns (bool) {
        return _topicExists[topic];
    }

    function _addTopic(uint256 topic) private {
        if (_topicExists[topic]) return;
        _topicExists[topic] = true;
        _topics.push(topic);
        emit ClaimTopicAdded(topic);
    }
}
