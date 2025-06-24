// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.20;

import {IOracle} from "./interface/IOracle.sol";
import {IRytTeller} from "./interface/IRytTeller.sol";

contract RytOracleAdaptor is IOracle {
    address public immutable rytTeller;
    uint256 public immutable adjustmentFactor;

    constructor(
        address rytTeller_,
        uint256 adjustmentFactor_
    ) {
        rytTeller = rytTeller_;
        adjustmentFactor = adjustmentFactor_;
    }

    function price() external view returns (uint256) {
        ( , , uint256 _price) = IRytTeller(rytTeller).quoteInvest(1 ether);
        return _price * adjustmentFactor;
    }
}
