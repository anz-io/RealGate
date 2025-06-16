// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

interface IMockERC20 is IERC20 {
    function setBalance(address account, uint256 amount) external;
}