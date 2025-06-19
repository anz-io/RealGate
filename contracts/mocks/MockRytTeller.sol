// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.20;

import {IRytTeller} from "../interface/IRytTeller.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockRytTeller is IRytTeller {

    uint256 public constant ORACLE_PRICE_SCALE = 1e36;
    IERC20 public immutable quoteToken;
    IERC20 public immutable baseToken;

    constructor(
        address quoteToken_,
        address baseToken_
    ) {
        quoteToken = IERC20(quoteToken_);
        baseToken = IERC20(baseToken_);
    }

    function quoteInvest(
        uint256 _amountIn
    ) public pure returns (uint256 _amountOut, uint256 _fee, uint256 _price) {
        _price = 1050 * ORACLE_PRICE_SCALE;
        _fee = 0;
        _amountOut = _amountIn * ORACLE_PRICE_SCALE / _price;
    }

    function invest(uint256 _amountIn, uint256 _minAmountOut) external returns (uint256 _amountOut) {
        (_amountOut, , ) = quoteInvest(_amountIn);
        require(_amountOut >= _minAmountOut, "MockRytTeller: Insufficient output amount");
        baseToken.transferFrom(msg.sender, address(this), _amountIn);
        quoteToken.transfer(msg.sender, _amountOut);
    }
    
}