// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

import "./IOracle.sol";

interface IMockOracle is IOracle {
    function setPrice(uint256 price) external;
}