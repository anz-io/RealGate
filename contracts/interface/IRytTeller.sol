// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.20;

interface IRytTeller {
    function quoteInvest(
        uint256 _amountIn
    ) external view returns (uint256 _amountOut, uint256 _fee, uint256 _price);

    function invest(
        uint256 _amountIn, 
        uint256 _minAmountOut
    ) external returns (uint256 _amountOut);
}