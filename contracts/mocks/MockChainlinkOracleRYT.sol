// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRytTeller {
    function quoteRedeem(
        uint256 _amountIn
    ) external view returns (uint256 _amountOut, uint256 _fee, uint256 _price);
}

contract MockChainlinkOracleRYT {

    uint8 public mockDecimals;
    uint80 public mockLatestRoundId;
    uint256 public mockLatestTimestamp;
    address public immutable rytTeller;

    constructor(address _rytTeller) {
        rytTeller = _rytTeller;
        mockDecimals = 4;
    }

    function decimals() external view returns (uint8) {
        return mockDecimals;
    }

    function latestAnswer() public view returns (int256) {
        ( , , uint256 price) = IRytTeller(rytTeller).quoteRedeem(1 ether);
        return int256(price);
    }

    function latestRound() public view returns (uint256) {
        return uint256(mockLatestRoundId);
    }

    function latestRoundData()
        public
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
            latestAnswer(),
            mockLatestTimestamp, // mock: startedAt == updatedAt
            mockLatestTimestamp,
            mockLatestRoundId // mock: answeredInRound == roundId
        );
    }

    function setDecimals(uint8 _newDecimals) external {
        mockDecimals = _newDecimals;
    }

    function setLatestRoundId(uint80 _newRoundId) external {
        mockLatestRoundId = _newRoundId;
        mockLatestTimestamp = block.timestamp;
    }

}