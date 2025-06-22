// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.20;

import {IMorpho, MarketParams, Position, Id} from "./interface/IMorpho.sol";
import {IMorphoFlashLoanCallback} from "./interface/IMorphoCallbacks.sol";
import {IOracle} from "./interface/IOracle.sol";
import {IRytTeller} from "./interface/IRytTeller.sol";
import {MathLib, WAD} from "./libraries/MathLib.sol";

import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";


contract LeverageEngine is OwnableUpgradeable, IMorphoFlashLoanCallback {

    // ============================= Libraries =============================

    using MathLib for uint256;
    using SafeERC20 for IERC20;

    enum OnFlashLoanAction {
        OpenPosition,
        ClosePosition
    }

    uint256 constant ORACLE_PRICE_SCALE = 1e36;
    uint256 constant MARKET_PARAMS_BYTES_LENGTH = 5 * 32;


    // ============================= Parameters ============================

    address public MORPHO;

    
    // ============================== Storage ==============================


    // =============================== Events ==============================


    // ======================= Modifier & Initializer ======================

    function initialize(address morpho_) initializer public {
        __Ownable_init(_msgSender());
        MORPHO = morpho_;
    }

    modifier onlyMorpho() {
        require(_msgSender() == MORPHO, "only Morpho contract can call");
        _;
    }



    // =========================== View functions ==========================

    /// @notice Returns the id of the market `marketParams`.
    /// @dev Sourced from Morpho Blue's `MarketParamsLib.sol`.
    function id(MarketParams memory marketParams) internal pure returns (Id marketParamsId) {
        assembly ("memory-safe") {
            marketParamsId := keccak256(marketParams, MARKET_PARAMS_BYTES_LENGTH)
        }
    }


    // ========================== Write functions ==========================

    /// @notice Opens a leveraged position in a Morpho market through flashloan
    /// @dev This function performs flashloan to achieve the desired leverage multiplier
    /// @param marketParams The market parameters struct containing market configuration 
    ///        (loanToken, collateralToken, oracle, irm, lltv)
    /// @param baseAssets The amount of initial collateral assets to be supplied (in collateral token decimals)
    /// @param multiplier The desired leverage multiplier, where 1e18 represents 1x leverage
    ///        Example: 1.5e18 means the final collateral position will be 1.5x the initial assets
    /// @param maxSlippage The maximum acceptable slippage for swaps, where 1e18 = 100%.
    ///        For example, 0.05e18 means a maximum slippage of 5%, so 
    ///         minAmountOut = price * amountIn * (1 - maxSlippage / 1e18)
    ///         where `minAmountOut` is the minimum amount of collateral token that must be received in the swap.
    /// @custom:requirements
    ///   - multiplier must be > 1e18 (no de-leveraging)
    ///   - multiplier must not be too high to maintain position health above market's LLTV after leverage
    function openPosition(
        MarketParams memory marketParams,
        uint256 baseAssets,
        uint256 multiplier,
        uint256 maxSlippage,
        address onBehalf,
        address rytTeller       // TODO: add annotation
    ) public {
        // Check conditions
        require(baseAssets > 0, "base assets must be greater than 0");
        require(multiplier > WAD, "multiplier must be greater than 1x");
        require(maxSlippage < WAD, "slippage must be less than 100%");
        require(
            multiplier < WAD.mulDivDown(WAD, WAD - marketParams.lltv),
            "multiplier exceeds max allowed"
        );

        // Calculations
        uint256 collateralPrice = IOracle(marketParams.oracle).price();
        uint256 quoteAssets = baseAssets.mulDivDown(collateralPrice, ORACLE_PRICE_SCALE);
        uint256 flashloanQuoteAssets = quoteAssets.mulDivDown(multiplier - WAD, WAD);
        uint256 expectedBaseAssets = baseAssets.mulDivDown(multiplier - WAD, WAD);
        uint256 minOutBaseAssets = expectedBaseAssets.mulDivDown(WAD - maxSlippage, WAD);

        // Transfer base assets
        IERC20(marketParams.collateralToken).safeTransferFrom(
            _msgSender(), address(this), baseAssets
        );

        // Flashloan
        require(
            IERC20(marketParams.loanToken).balanceOf(MORPHO) >= flashloanQuoteAssets,
            "lending pool's loan token balance too low"
        );
        IMorpho(MORPHO).flashLoan(
            marketParams.loanToken, 
            flashloanQuoteAssets, 
            abi.encode(
                OnFlashLoanAction.OpenPosition,
                marketParams,
                baseAssets,
                minOutBaseAssets,
                0,  // no repay shares
                onBehalf,
                rytTeller
            )
        );
    }
    
    // Close position and get the remaining loan token (quote token)
    function closePosition(
        MarketParams memory marketParams,
        uint256 minOutQuoteAssets,
        address onBehalf,
        address rytTeller
    ) public {
        Position memory position = IMorpho(MORPHO).position(id(marketParams), onBehalf);
        uint256 maxFlashLoanAssets = IERC20(marketParams.loanToken).balanceOf(MORPHO);

        IMorpho(MORPHO).flashLoan(
            marketParams.loanToken,
            maxFlashLoanAssets,     // flashloan enough loan token to repay the position
            abi.encode(
                OnFlashLoanAction.ClosePosition,
                marketParams,
                position.collateral,
                minOutQuoteAssets,
                position.borrowShares,
                onBehalf,
                rytTeller
            )
        );

        IERC20(marketParams.loanToken).forceApprove(MORPHO, 0);
    }

    // TODO: add annotation
    function onMorphoFlashLoan(uint256 assets, bytes calldata data) public onlyMorpho {
        // Decode calldata
        (
            OnFlashLoanAction action,
            MarketParams memory marketParams,
            uint256 inAssets,
            uint256 minOutAssets,
            uint256 repayShares,
            address onBehalf,
            address rytTeller
        ) = abi.decode(data, (OnFlashLoanAction, MarketParams, uint256, uint256, uint256, address, address));

        if (action == OnFlashLoanAction.OpenPosition) {
            // Swap loan token (quote token) to collateral token (base token)
            IERC20(marketParams.loanToken).forceApprove(rytTeller, assets);
            uint256 outBaseAssets = IRytTeller(rytTeller).invest(assets, minOutAssets);
            require(outBaseAssets >= minOutAssets, "swap-out assets too low");

            // Supply collateral token (base token)
            uint256 totalBaseAssets = inAssets + outBaseAssets;
            IERC20(marketParams.collateralToken).forceApprove(MORPHO, totalBaseAssets);
            IMorpho(MORPHO).supplyCollateral(marketParams, totalBaseAssets, onBehalf, "");

            // Borrow loan token (quote token)
            IMorpho(MORPHO).borrow(marketParams, assets, 0, onBehalf, address(this));

            // Approve to repay loan token (quote token)
            IERC20(marketParams.loanToken).forceApprove(MORPHO, assets);
        }

        else if (action == OnFlashLoanAction.ClosePosition) {
            // Repay loan token (quote token)
            IERC20(marketParams.loanToken).forceApprove(MORPHO, type(uint256).max);
            (uint256 repayAssets, ) = IMorpho(MORPHO).repay(marketParams, 0, repayShares, onBehalf, "");

            // Withdraw collateral token (base token)
            IMorpho(MORPHO).withdrawCollateral(marketParams, inAssets, onBehalf, address(this));

            // Swap collateral token (base token) to loan token (quote token)
            IERC20(marketParams.collateralToken).forceApprove(rytTeller, inAssets);
            uint256 outQuoteAssets = IRytTeller(rytTeller).redeem(inAssets, minOutAssets);
            require(outQuoteAssets >= minOutAssets, "swap-out assets too low");

            // Send remaining loan token (quote token) to onBehalf
            IERC20(marketParams.loanToken).safeTransfer(onBehalf, outQuoteAssets - repayAssets);
        }
    }


    // ====================== Write functions - admin ======================


}