pragma solidity ^0.4.24;

import "./Ownable.sol";
import "./ERC20BurnMint.sol";
import "./MultiSigWallet.sol";

contract Crowdsale is Ownable {
    ERC20BurnMint public token;
    MultiSigWallet public multisig;
    uint256 public rate;
    bool public isAvailable;
    uint256 public totalSupply;

    uint256 public maxCountOfTokens = 880000000 * 1e18;
    uint256 public preICOLimit = 150000000 * 1e18;
    uint256 public firstStageLimit = 400000000 * 1e18;
    uint256 public secondStageLimit = 700000000 * 1e18;
    uint256 public softCup = 12000000 * 1e18;

    uint256 public preICOBonus = 40;
    uint256 public firstStageBonus = 25;
    uint256 public secondStageBonus = 10;
    uint256 public thirdStageBonus = 0;

    bool public isPreFinished = false;
    uint256 public endOfCrowdsale;
    uint256 public durationCrowdsale;
    uint256 public freezePeriod;
    bool isInit = false;

    address teamW;
    address reserveW;
    address bountyW;
    address advisorsW;
    address strategicW;
    address ecosystemW;

    event CreatedTokens(address spender, uint256 value, uint256 totalTokens);
    event BoughtTokens(address spender, uint256 weiAmount, uint tokensValue, uint256 totalTokens);
    event DeletedTokens(uint256 value, uint256 totalTokens);
    event TokensRateChanged(uint256 newRate);

    modifier validCreation {
        require(totalSupply <= maxCountOfTokens, "supply error");
        require(isAvailable, "not available");
        _;
    }

    /**
     * @notice constructor which sets the information about token's crowdsale
     * @param _walletForEth address of account to which ether will be sent
     * @param _rate amount of tokenAs per 1 ether
     * @param _tokenA address of Mintable token for crowdsale
     * @param _durationInDays how long ICO will be available in days
     * @param _freezePeriod how long tokens will be unavailable for transfer after ICO
     */
    constructor(
        MultiSigWallet _walletForEth,
        uint256 _rate,
        ERC20BurnMint _tokenA,
        uint256 _durationInDays,
        uint256 _freezePeriod
    )
    public
    {
        multisig = _walletForEth;
        rate = _rate;
        token = _tokenA;
        isAvailable = true;
        durationCrowdsale = _durationInDays;
        freezePeriod = _freezePeriod;
    }

    /**
     * @notice setting information about pool accounts, mint all tokens to the contract, setting time for unlock tokens
     * @param _teamW address of Team Wallet
     * @param _reserveW address of Reserve Wallet
     * @param _bountyW address of Bounty Wallet
     * @param _advisorsW address of Advisory Wallet
     * @param _strategicW address of Stragtegic Partner Wallet
     * @param _ecosystemW address of Ecosystem Growth Wallet
     */
    function init(
        address _teamW,
        address _reserveW,
        address _bountyW,
        address _advisorsW,
        address _strategicW,
        address _ecosystemW
    )
    public
    onlyOwner
    {
        require(!isInit);

        durationCrowdsale *= 1 days;
        endOfCrowdsale = now + durationCrowdsale;
        freezePeriod *= 1 days;

        token.mint(address(this), 1600000000 * 1e18);
        isInit = true;
        teamW = _teamW;
        bountyW = _bountyW;
        reserveW = _reserveW;
        advisorsW = _advisorsW;
        strategicW = _strategicW;
        ecosystemW = _ecosystemW;

        token.setBTRWallet(_bountyW, _teamW, _reserveW);
        token.transfer(teamW, 160000000 * 1e18);
        token.transfer(reserveW, 160000000 * 1e18);
        token.transfer(bountyW, 32000000 * 1e18);
        token.transfer(advisorsW, 32000000 * 1e18);
        token.transfer(strategicW, 16000000 * 1e18);
        token.transfer(ecosystemW, 320000000 * 1e18);
    }

    /**
     * @notice this function is need for changing the number of tokens per 1 ether for crowdsale
     * @param _rate new rate for tokens buying
     */
    function setNewRate(uint256 _rate) public onlyOwner {
        rate = _rate;
        emit TokensRateChanged(rate);
    }

    /**
     * @notice pause the crowdsale for some time
     */
    function pauseCrowdsale() public onlyOwner {
        isAvailable = false;
    }

    /**
     * @notice start again the crowdsale
     */
    function startCrowdsale() public onlyOwner {
        require(token.isICOCrashed() == false);
        require(endOfCrowdsale > now);
        isAvailable = true;
    }

    /**
     * @notice if ICO failed - send signal and stop to sell tokens
     */
    function crashCrowdsale() public onlyOwner {
        crashCrowdsaleInternal();
    }

    /**
     * @notice stop the crowdsale and set the time of unlocking tokens
     */
    function finishCrowdsale() public onlyOwner {
        finishCrowdsaleInternal();
    }

    /**
     * @notice internal crash of crowdsale
     */
    function crashCrowdsaleInternal() internal {
        require(softCup > totalSupply);
        isAvailable = false;
        multisig.crashCrowd();
        token.crashCrowd();
    }

    /**
     * @notice internal finish of crowdsale
     */
    function finishCrowdsaleInternal() internal {
        isAvailable = false;

        uint256 timeUnlockT = now + 2 years;
        uint256 timeUnlockR = now + 1 years;

        endOfCrowdsale = now;
        multisig.finishCrowd();
        token.setTimeUnlock(now + freezePeriod, timeUnlockT, timeUnlockR);
    }

    /**
     * @notice buy tokens for msg.sender via ether which sent to the setted wallet
     * @dev tokens will be sent from contract's wallet to receiver
     */
    function buyTokens() payable public validCreation {
        require(msg.value > 0, "zero ether");

        uint256 tokens = rate * msg.value;
        tokens = findTokensAmount(tokens);

        uint256 totalNumber = addTokensToWallet(msg.sender, tokens);
        token.addPayment(msg.sender, msg.value);

        address(multisig).transfer(msg.value);

        emit BoughtTokens(msg.sender, msg.value, totalNumber / 1e18, totalSupply / 1e18);
    }

    /**
     * @notice function for transfer tokens from contract wallet to receiver and checking the limits and adding bonuses for owners
     * @param _to address of receiver of tokens
     * @param _value the number of tokens for transfer
     */
    function addTokensToWallet(address _to, uint256 _value) internal returns (uint256) {
        if(now > endOfCrowdsale) {
            crashCrowdsaleInternal();
        }

        require(totalSupply + _value<= maxCountOfTokens);
        require(isAvailable);

        token.transfer(_to, _value);

        totalSupply += _value;

        if(totalSupply == maxCountOfTokens) {
            isAvailable = false;
            finishCrowdsaleInternal();
        }

        if(isPreFinished == false && totalSupply >= preICOLimit) {
            isPreFinished = true;
            isAvailable = false;
        }

        return _value;
    }

    /**
     * @notice sending tokens to receiver without ether transactions
     * @param _to address of receiver
     * @param _value the number of tokens for transfer
     */
    function createTokens(address _to, uint256 _value) public validCreation onlyOwner {
        uint256 tokens = findTokensAmount(_value * 1e18);
        uint256 totalNumber = addTokensToWallet(_to, tokens);

        emit CreatedTokens(_to, totalNumber / 1e18, totalSupply / 1e18);
    }

    /**
     * @notice sending tokens to 0x0 address
     * @param _value the number of tokens for transfer
     */
    function deleteTokens(uint256 _value) public onlyOwner validCreation {
        addTokensToWallet(0x0, _value * 1e18);

        emit DeletedTokens(_value / 1e18, totalSupply / 1e18);
    }

    /**
     * @notice find the number of tokens for transaction considering active stage
     * @param _elementaryAmount the number of tokens without bonuses
     */
    function findTokensAmount(uint256 _elementaryAmount) view internal returns (uint256) {
        uint256 bonus;

        if(totalSupply < preICOLimit) {
            bonus = preICOBonus;
        } else if(totalSupply >= preICOLimit && totalSupply < firstStageLimit) {
            bonus = firstStageBonus;
        } else if(totalSupply >= firstStageLimit && totalSupply < secondStageLimit) {
            bonus = secondStageBonus;
        } else if(totalSupply >= secondStageLimit && totalSupply <= maxCountOfTokens) {
            bonus = thirdStageBonus;
        }

        return _elementaryAmount + _elementaryAmount * bonus / 100;
    }

    /**
     * @notice fallback function for buying tokens
     */
    function() public payable {
        buyTokens();
    }

    /**
     * @notice give back ether of address when ICO is crashed
     * @param _address address of payer
     * @param _value number of ether for transfer
     */
    function refund(address _address, uint256 _value) public {
        require(!isAvailable);
        require(msg.sender == address(token));
        multisig.refund(_address, _value);
    }
}
