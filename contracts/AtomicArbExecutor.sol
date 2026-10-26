// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IV2Router {
    function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts);
}

interface IFlashLoanSimpleReceiver {
    function ADDRESSES_PROVIDER() external view returns (address);
    function executeOperation(address asset, uint256 amount, uint256 premium, address initiator, bytes calldata params) external returns (bool);
}

interface IPoolAddressesProvider { function getPool() external view returns (address); }
interface IPool {
    function flashLoanSimple(address receiverAddress, address asset, uint256 amount, bytes calldata params, uint16 referralCode) external;
}

/**
 * Two-leg flash-loan executor with strict allowlists and repayment checks.
 *
 * This is a review/test component. It supports an Aave-style flashLoanSimple
 * callback. Before funds are used, deploy only after fork tests, address
 * verification, and independent security review.
 */
contract AtomicArbExecutor is IFlashLoanSimpleReceiver {
    address public owner;
    address public profitRecipient;
    address public immutable provider;
    address public immutable flashPool;
    bool public paused = true;
    uint256 public maxTradeAmount;
    uint256 public minProfit;
    mapping(address => bool) public allowedRouter;
    mapping(address => bool) public allowedToken;

    error NotOwner(); error Paused(); error NotPool(); error NotAllowed(); error InvalidPath();
    error DeadlineExpired(); error InsufficientProfit(); error TransferFailed(); error BadInitiator();

    modifier onlyOwner() { if (msg.sender != owner) revert NotOwner(); _; }
    modifier onlyPool() { if (msg.sender != flashPool) revert NotPool(); _; }

    constructor(address provider_, address pool, address recipient) {
        if (provider_ == address(0) || pool == address(0) || recipient == address(0)) revert InvalidPath();
        owner = msg.sender; provider = provider_; flashPool = pool; profitRecipient = recipient;
    }

    function ADDRESSES_PROVIDER() external view returns (address) { return provider; }

    function configureRisk(uint256 maxTrade, uint256 minimumProfit) external onlyOwner { maxTradeAmount = maxTrade; minProfit = minimumProfit; }
    function setRouter(address router, bool allowed) external onlyOwner { allowedRouter[router] = allowed; }
    function setToken(address token, bool allowed) external onlyOwner { allowedToken[token] = allowed; }
    function setPaused(bool value) external onlyOwner { paused = value; }
    function setProfitRecipient(address recipient) external onlyOwner { if (recipient == address(0)) revert InvalidPath(); profitRecipient = recipient; }

    function requestFlashLoan(address asset, uint256 amount, bytes calldata params) external onlyOwner {
        if (paused) revert Paused();
        if (!allowedToken[asset] || amount == 0 || amount > maxTradeAmount) revert NotAllowed();
        IPool(flashPool).flashLoanSimple(address(this), asset, amount, params, 0);
    }

    function executeOperation(address asset, uint256 amount, uint256 premium, address initiator, bytes calldata params)
        external onlyPool returns (bool)
    {
        if (paused) revert Paused();
        if (initiator != address(this)) revert BadInitiator();
        (
            address tokenMid, uint256 minMidOut, uint256 minFinalOut,
            address buyRouter, address sellRouter, uint256 deadline
        ) = abi.decode(params, (address, uint256, uint256, address, address, uint256));
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (!allowedToken[asset] || !allowedToken[tokenMid]) revert NotAllowed();
        if (!allowedRouter[buyRouter] || !allowedRouter[sellRouter] || buyRouter == sellRouter) revert NotAllowed();
        if (amount == 0 || amount > maxTradeAmount) revert InvalidPath();

        uint256 starting = IERC20(asset).balanceOf(address(this));
        if (!IERC20(asset).approve(buyRouter, amount)) revert TransferFailed();
        IV2Router(buyRouter).swapExactTokensForTokens(amount, minMidOut, _path(asset, tokenMid), address(this), deadline);
        uint256 mid = IERC20(tokenMid).balanceOf(address(this));
        if (mid == 0 || !IERC20(tokenMid).approve(sellRouter, mid)) revert TransferFailed();
        IV2Router(sellRouter).swapExactTokensForTokens(mid, minFinalOut, _path(tokenMid, asset), address(this), deadline);

        uint256 finalBalance = IERC20(asset).balanceOf(address(this));
        uint256 owed = amount + premium;
        if (finalBalance < owed + minProfit || finalBalance < starting + minProfit) revert InsufficientProfit();
        if (!IERC20(asset).approve(flashPool, owed)) revert TransferFailed();
        uint256 profit = finalBalance - owed;
        if (!IERC20(asset).transfer(profitRecipient, profit)) revert TransferFailed();
        return true;
    }

    function _path(address a, address b) private pure returns (address[] memory p) { p = new address[](2); p[0] = a; p[1] = b; }
    function rescue(address token, uint256 amount) external onlyOwner { if (!IERC20(token).transfer(profitRecipient, amount)) revert TransferFailed(); }
}
