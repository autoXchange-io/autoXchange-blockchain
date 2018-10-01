pragma solidity ^0.4.24;

import "./ERC20.sol";
import "./Ownable.sol";
import "./MigrationAgent.sol";

contract ERC20BurnMint is ERC20, Ownable {
    
    event Mint(address indexedTo, uint256 amount);
    event Burn(address indexedBurner, uint256 value);
    event Migrate(address usersAddress, uint value);
    event Refund(address userAddress, uint value);

    MigrationAgent public migrationAgent;
    bool public mintingFinished = false;

    /**
     * @notice add ether transaction to history
     * @param _address address of payer
     * @param _weiValue transaction amount
     */
    function addPayment(address _address, uint256 _weiValue) public {
        require(saleAgent == msg.sender);
        payments[_address] += _weiValue;
    }

    /**
     * @notice payment of user
     * @param _address address of payer
     * @return transaction amount
     */
    function getPayment(address _address) view public returns (uint256) {
        return payments[_address];
    }

    /**
     * @notice setting information about token
     * @param _name full name of token
     * @param _symbol short name of token
     * @param _decimals number of 0 of the token
     */ 
    constructor(string _name, string _symbol, uint8 _decimals) public {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    /**
     * @notice set the address of migration agent for migrations
     * @param _address address of migration agent
     */
    function setMigrationAgent(MigrationAgent _address) external onlyOwner {
        require(_address != address(0));
        require(canTransfer);
        migrationAgent = _address;
        canTransfer = false;
        migrationStarted = true;
        migrationAgent.setTotalSupply(totalSupply);
    }

    /**
     * @notice set the sale agent, who can mint tokens
     * @param _address address of the sale agent
     */
    function setSaleAgent(address _address) public onlyOwner {
        require(saleAgent == 0x0);
        saleAgent = _address;
    }

    /**
     * @notice set the address of crowdsale for changing the state
     * @param _address address of the crowdsale
     */
    function setCrowdsaleAddress(address _address) public onlyOwner {
        require(address(crowdsaleAddress) == 0x0);
        crowdsaleAddress = Crowdsale(_address);
    }

    /**
     * @notice migrate senders tokens to another contract
     * @param _tokensCount the number of tokens for transfer
     */
    function migrate(uint256 _tokensCount) external {
        doMigrate(msg.sender, _tokensCount);
    }

    /**
     * @notice migrate users tokens by indexes from start for their count
     * @param startIndex index of first user for migration
     * @param usersCount the number of users for migration
     */
    function migrateAll(uint256 startIndex, uint256 usersCount) external onlyOwner {
        uint256 firstNumber = startIndex;
        if(firstNumber == 0) {
            firstNumber = 1;
        }

        for(uint256 i = firstNumber; i < firstNumber + usersCount || i <= totalUsers; i++) {
            uint256 balance = balanceOf(userByIndex[i]);
            doMigrate(userByIndex[i], balance);
        }
    }

    /**
     * @notice do migration for current user
     * @param _address address of user for migration
     * @param _tokensCount the number of tokens for migration
     */
    function doMigrate(address _address, uint256 _tokensCount) private {
        require(balanceOf(_address) >= _tokensCount);
        burn();
        migrationAgent.migrate(msg.sender, _tokensCount);
        emit Migrate(_address, _tokensCount);
    }

    /**
     * @notice fallback function, which decline ether transactions
     */
    function() public payable {
        revert();
    }
  
    /**
     * @notice Function to mint tokens
     * @param _to The address that will receive the minted tokens.
     * @param _amount The amount of tokens to mint.
     * @return true when operation is successful
     */
    function mint(address _to, uint256 _amount) public {
      require(!mintingFinished);
      require(!migrationStarted);
      require(saleAgent == msg.sender);
      totalSupply += _amount;
      balances[_to] += _amount;

      addUser(_to);
      emit Mint(_to, _amount);
    }

    /**
     * @notice Burns all tokens from msg.sender.
     */
    function burn() public {
        require(isICOCrashed);
        require(migrationStarted == false);
        burnBase(msg.sender);
    }

    /**
     * @notice Burns a specific amount of tokens. owner can burn only if user bought tokens not with ether
     * @param _address address of token's owner
     */
    function burnFrom(address _address) public onlyOwner {
        require(isICOCrashed);
        burnBase(_address);
    }

    /**
     * @notice Burns all tokens of user.
     * @param _address address of token's owner
     */
    function burnBase(address _address) internal {
        uint256 amount = balances[_address];
        totalSupply -= amount;
        balances[_address] = 0;
        emit Burn(_address, amount);
    }

    /**
     * @notice now user can refund their ether
     */
    function crashCrowd() public onlyCrowdsale {
        isICOCrashed = true;
    }

    /**
     * @notice give back ether of payer (msg.sender) when ICO is crashed
     */
    function refund() public {
        require(isICOCrashed);
        require(payments[msg.sender] > 0);
        crowdsaleAddress.refund(msg.sender, payments[msg.sender]);
        uint256 pay = payments[msg.sender];
        payments[msg.sender] = 0;
        burn();
        emit Refund(msg.sender, pay);
    }
}
