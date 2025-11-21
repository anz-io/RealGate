// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import {IOracle} from "../interface/IOracle.sol";

contract MockOracle is IOracle {

    uint256 public price;
    string public name;

    constructor(string memory _name, uint256 _price) {
        name = _name;
        price = _price;
    }

    function setPrice(uint256 newPrice) external {
        price = newPrice;
    }
}
