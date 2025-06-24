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

    address public MORPHO;

    uint256 internal _sendbackQuoteAssets;


    // =============================== Events ==============================

    event PositionOpened(
        MarketParams marketParams,
        uint256 baseAssets,
        uint256 multiplier,
        uint256 maxSlippage,
        address onBehalf,
        Position position
    );
    event PositionClosed(
        MarketParams marketParams,
        uint256 minOutQuoteAssets,
        uint256 sendbackQuoteAssets,
        address onBehalf,
        Position position
    );


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

    /**
     * @notice Opens a leveraged position in a Morpho market using a flash loan.
     * @dev This function supplies the specified collateral, borrows additional assets via flash loan,
     *      and supplies the total collateral to achieve the desired leverage. The function ensures
     *      the leverage multiplier is valid and that slippage constraints are respected.
     *      The flash loan callback will execute the actual leveraged supply and any required swaps.
     * @param marketParams Struct containing the market configuration:
     *        - loanToken: The address of the asset to borrow (debt token)
     *        - collateralToken: The address of the asset to supply as collateral
     *        - oracle: The address of the price oracle for the collateral
     *        - irm: The address of the interest rate model
     *        - lltv: The loan-to-value ratio (scaled by 1e18)
     *        Note that the marketParams must be registered in Morpho before calling this function.
     * @param baseAssets The amount of collateral token to supply initially (in collateral token decimals)
     * @param multiplier The target leverage multiplier (scaled by 1e18, e.g., 2e18 = 2x leverage).
     *                   Must be greater than 1e18 (no deleveraging) and within safe limits.
     * @param maxSlippage The maximum allowed slippage for swaps (scaled by 1e18, e.g., 0.05e18 = 5%).
     *                   Used to calculate the minimum acceptable amount received in swaps.
     * @param onBehalf The address for whom the leveraged position is opened.
     *                   Must be authorized in Morpho.
     * @param rytTeller The address of the RytTeller contract (used for additional integrations).
     * @custom:requirements
     *   - baseAssets must be greater than 0.
     *   - multiplier must be greater than 1e18 and not exceed the maximum allowed by the market's LLTV.
     *   - maxSlippage must be less than 1e18 (100%).
     *   - The lending pool must have sufficient loan token balance for the flash loan.
     * @custom:actions
     *   - Transfers the initial collateral from the user.
     *   - Initiates a flash loan for the additional borrowed amount.
     *   - Encodes all parameters and calls the Morpho contract's flashLoan function.
     */
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

        // Event
        emit PositionOpened(
            marketParams, baseAssets, multiplier, maxSlippage, onBehalf, 
            IMorpho(MORPHO).position(id(marketParams), onBehalf)
        );
    }
    
    /**
     * @notice Closes a leveraged position in a Morpho market.
     * @dev Uses a flash loan to repay debt and withdraw collateral.
     *      The actual close logic is handled in the flash loan callback.
     * @param marketParams Struct with market configuration:
     *        - loanToken: Debt token address
     *        - collateralToken: Collateral token address
     *        - oracle: Price oracle address
     *        - irm: Interest rate model address
     *        - lltv: Loan-to-value ratio (scaled by 1e18)
     *        Note that the marketParams must be registered in Morpho before calling this function.
     * @param minOutQuoteAssets Minimum loan token to receive when swapping.
     * @param onBehalf Address for whom the position is closed.
     * @param rytTeller RytTeller contract address for swaps or integrations.
     * @custom:actions
     *   - Gets user position and available loan token.
     *   - Starts a flash loan to repay the position.
     *   - Encodes parameters and calls Morpho's flashLoan.
     *   - Resets loan token approval after operation.
     */
    function closePosition(
        MarketParams memory marketParams,
        uint256 minOutQuoteAssets,
        address onBehalf,
        address rytTeller
    ) public {
        // Retrieve position information
        Position memory position = IMorpho(MORPHO).position(id(marketParams), onBehalf);
        uint256 maxFlashLoanAssets = IERC20(marketParams.loanToken).balanceOf(MORPHO);

        // Flashloan
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

        // Reset approval
        IERC20(marketParams.loanToken).forceApprove(MORPHO, 0);

        // Event
        emit PositionClosed(
            marketParams, minOutQuoteAssets, _sendbackQuoteAssets, onBehalf, 
            IMorpho(MORPHO).position(id(marketParams), onBehalf)
        );
        _sendbackQuoteAssets = 0;
    }

    /**
     * @notice Callback after Morpho flash loan, for open/close position.
     * @dev Decodes parameters and runs logic based on action type.
     *      Only Morpho can call this function.
     * @param assets Amount of loan token from flash loan.
     * @param data ABI-encoded action type, market, amounts, slippage, addresses.
     * @custom:actions
     *   - Decodes action and parameters from calldata.
     *   - For OpenPosition:
     *       - Swaps loan token to collateral via RytTeller.
     *       - Supplies collateral to Morpho.
     *       - Borrows loan token and approves repayment.
     *   - For ClosePosition:
     *       - Repays loan.
     *       - Withdraws collateral from Morpho.
     *       - Swaps collateral to loan token via RytTeller.
     *       - Sends remaining loan token to user.
     * @custom:requirements
     *   - Only Morpho can call.
     *   - Swaps must meet minimum output for slippage protection.
     */
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
            _sendbackQuoteAssets = outQuoteAssets - repayAssets;     // Only for event
        }
    }

}