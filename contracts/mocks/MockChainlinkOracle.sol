// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockChainlinkOracle {

    uint8 public mockDecimals;
    int256 public mockLatestAnswer;
    uint80 public mockLatestRoundId;
    uint256 public mockLatestTimestamp;

    constructor(uint8 _initialDecimals, int256 _initialAnswer) {
        mockDecimals = _initialDecimals;
        mockLatestAnswer = _initialAnswer;
        mockLatestRoundId = 1; // Initial Round ID
        mockLatestTimestamp = block.timestamp;
    }

    function decimals() external view returns (uint8) {
        return mockDecimals;
    }

    function latestAnswer() external view returns (int256) {
        return mockLatestAnswer;
    }

    function latestRound() external view returns (uint256) {
        return uint256(mockLatestRoundId);
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            mockLatestRoundId,
            mockLatestAnswer,
            mockLatestTimestamp, // mock: startedAt == updatedAt
            mockLatestTimestamp,
            mockLatestRoundId // mock: answeredInRound == roundId
        );
    }

    function setDecimals(uint8 _newDecimals) external {
        mockDecimals = _newDecimals;
    }

    function setLatestAnswer(int256 _newAnswer) external {
        mockLatestAnswer = _newAnswer;
        mockLatestTimestamp = block.timestamp;
    }

    function setLatestRoundId(uint80 _newRoundId) external {
        mockLatestRoundId = _newRoundId;
        mockLatestTimestamp = block.timestamp;
    }

    function updatePrice(int256 _newAnswer) external {
        mockLatestAnswer = _newAnswer;
        mockLatestRoundId = mockLatestRoundId + 1; // Auto-increment the Round ID
        mockLatestTimestamp = block.timestamp;
    }
}