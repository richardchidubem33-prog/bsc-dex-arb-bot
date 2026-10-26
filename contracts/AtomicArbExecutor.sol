// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/**
 * Guarded two-leg executor. This is intentionally not deploy-ready for funds:
 * a flash-loan/pair callback adapter must be integrated and independently audited.
 */
contract AtomicArbExecutor {
    address public owner;
    address public profitRecipient;
    bool public paused = true;
    uint256 public maxTradeAmount;
    uint256 public minProfit;
    mapping(address => bool) public allowedRouter;
    mapping(address => bool) public allowedToken;

    error NotOwner();
    error Paused();
    error NotAllowed();
    error InvalidPath();
    error DeadlineExpired();
    error InsufficientProfit();
    error TransferFailed();

    modifier onlyOwner() { if (msg.sender != owner) revert NotOwner(); _; }

    constructor(address recipient) {
        owner = msg.sender;
        profitRecipient = recipient;
    }

    function configureRisk(uint256 maxTrade, uint256 minimumProfit) external onlyOwner {
        maxTradeAmount = maxTrade;
        minProfit = minimumProfit;
    }

    function setRouter(address router, bool allowed) external onlyOwner { allowedRouter[router] = allowed; }
    function setToken(address token, bool allowed) external onlyOwner { allowedToken[token] = allowed; }
    function setPaused(bool value) external onlyOwner { paused = value; }
    function setProfitRecipient(address recipient) external onlyOwner { profitRecipient = recipient; }

    function executeTwoLeg(
        address tokenIn,
        address tokenMid,
        uint256 amountIn,
        uint256 minMidOut,
        uint256 minFinalOut,
        address buyRouter,
        address sellRouter,
        uint256 deadline
    ) external onlyOwner returns (uint256 finalAmount, uint256 profit) {
        if (paused) revert Paused();
        if (!allowedRouter[buyRouter] || !allowedRouter[sellRouter]) revert NotAllowed();
        if (!allowedToken[tokenIn] || !allowedToken[tokenMid]) revert NotAllowed();
        if (amountIn == 0 || amountIn > maxTradeAmount) revert InvalidPath();
        if (block.timestamp > deadline) revert DeadlineExpired();

        uint256 starting = IERC20(tokenIn).balanceOf(address(this));
        if (!IERC20(tokenIn).approve(buyRouter, amountIn)) revert TransferFailed();
        IV2Router(buyRouter).swapExactTokensForTokens(
            amountIn, minMidOut, _path(tokenIn, tokenMid), address(this), deadline
        );
        uint256 mid = IERC20(tokenMid).balanceOf(address(this));
        if (!IERC20(tokenMid).approve(sellRouter, mid)) revert TransferFailed();
        IV2Router(sellRouter).swapExactTokensForTokens(
            mid, minFinalOut, _path(tokenMid, tokenIn), address(this), deadline
        );

        finalAmount = IERC20(tokenIn).balanceOf(address(this));
        if (finalAmount < starting + minProfit) revert InsufficientProfit();
        profit = finalAmount - starting;
        if (!IERC20(tokenIn).transfer(profitRecipient, profit)) revert TransferFailed();
    }

    function _path(address a, address b) private pure returns (address[] memory p) {
        p = new address[](2); p[0] = a; p[1] = b;
    }

    function rescue(address token, uint256 amount) external onlyOwner {
        if (!IERC20(token).transfer(profitRecipient, amount)) revert TransferFailed();
    }
}
