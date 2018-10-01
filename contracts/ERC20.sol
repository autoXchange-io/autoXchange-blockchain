pragma solidity ^0.4.24;

import "./ERC20Basic.sol";
import "./Crowdsale.sol";

contract ERC20 is ERC20Basic{
    string public name;
    string public symbol;
    uint8 public decimals;
    address public saleAgent;
    //time when users can transfer tokens
    uint256 public timeUnlock = 9999999999999;
    bool public canTransfer = true;
    bool public isICOCrashed = false;
    bool public migrationStarted = false;

    //balances of users wallets
    mapping(address => uint256) balances;
    //allowance of users transfers
    mapping(address => mapping (address => uint256)) internal allowed;
    //list of users
    mapping(address => uint256) indexByUser;
    mapping(uint256 => address) userByIndex;
    //how many ether were sent from the address
    mapping(address => uint256) payments;

    uint256 public timeUnlockOfTeamWallet = 9999999999999;
    uint256 public timeUnlockOfReserveWallet = 9999999999999;
    address public bountyW;
    address public teamW;
    address public reserveW;

    uint256 public totalUsers;
    uint256 public totalSupply;
    Crowdsale crowdsaleAddress;

    modifier onlyCrowdsale() {
        require(msg.sender == address(crowdsaleAddress));
        _;
    }

    /**
     * @notice set the address of bounty wallet for referal and bounty system
     * @param _bountyW address of bounty wallet
     * @param _teamW address of teamWallet
     * @param _reserveW address of reserve wallet
     */
    function setBTRWallet(address _bountyW, address _teamW, address _reserveW) public onlyCrowdsale {
        bountyW = _bountyW;
        teamW = _teamW;
        reserveW = _reserveW;
    }

    /**
     * @notice add address to the list of users
     * @param _address address of wallet for adding
     */
    function addUser(address _address) public {
        if(indexByUser[_address] == 0) {
            totalUsers += 1;
            indexByUser[_address] = totalUsers;
            userByIndex[totalUsers] = _address;
        }
    }

    /**
     * @notice set the time when user can transfer tokens. only sale agent can change it
     * @param _newTime time in seconds when tokens are unlocked
     * @param _teamTime time in seconds when team wallet can transfer tokens
     * @param _reserveTime time in seconds when reserve wallet can transfer tokens
     */
    function setTimeUnlock(uint256 _newTime, uint256 _teamTime, uint256 _reserveTime) public {
        require(msg.sender == saleAgent);
        require(timeUnlock == 9999999999999);
        timeUnlock = _newTime;
        timeUnlockOfTeamWallet = _teamTime;
        timeUnlockOfReserveWallet = _reserveTime;
    }

    /**
     * @notice function for transfer tokens from address[0] to another user
     * @param _to address of receiver
     * @param _value amount of tokens for transfer
     * @return true when operation is successful
     */
    function transfer(address _to, uint256 _value) public {
        require(msg.sender == saleAgent || timeUnlock <= now || msg.sender == bountyW);

        if(msg.sender == teamW && timeUnlockOfTeamWallet > now) {
            revert();
        }
        if(msg.sender == reserveW && timeUnlockOfReserveWallet > now) {
            revert();
        }

        require(msg.sender != _to);
        require(migrationStarted == false);
        require(_value <= balances[msg.sender]);
        require(canTransfer);

        addUser(msg.sender);
        addUser(_to);
        balances[msg.sender] -= _value;
        balances[_to] += _value;
        emit Transfer(msg.sender, _to, _value);
    }

    /**
     * @notice getting the balance of user by address
     * @param _owner address of the wallet owner
     * @return uint256 the number of tokens on the wallet
     */
    function balanceOf(address _owner) public view returns (uint256) {
        return balances[_owner];
    }

    /**
     * @notice function transfer the authorized number of tokens from owner of tokens to spender
     * @param _from address from which tokens will write off
     * @param _to address of receiver of tokens
     * @param _value amount of tokens for transfer
     * @return true when operation is successful
     */
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    )
    public
    {
        require(_from == saleAgent || timeUnlock <= now);
        if(msg.sender == teamW && timeUnlockOfTeamWallet > now) {
            revert();
        }
        if(msg.sender == reserveW && timeUnlockOfReserveWallet > now) {
            revert();
        }
        require(migrationStarted == false);
        require(_to != 0x0);
        require(_value <= balances[_from]);
        require(_value <= allowed[_from][_to]);
        require(canTransfer);

        balances[_from] -= _value;
        balances[_to] += _value;
        allowed[_from][_to] -= _value;

        addUser(_from);
        addUser(_to);
        emit Transfer(_from, _to, _value);
    }

    /**
     * @notice function sets the number of tokens which spender can transfer from users wallet
     * @param _spender address of user who want take tokens
     * @param _value amount of tokens for transfer
     * @return true when operation is successful
     */
    function approve(address _spender, uint256 _value) public {
        require(msg.sender != _spender);
        require(_value <= balances[msg.sender]);
        allowed[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
    }

    /**
     * @notice function returns the number of tokens which another user or contract can recieve from token master
     * @param _owner address of sender
     * @param _spender address of spender
     * @return uint256 the amount of tokens which spender can take from sender's wallet 
     */
    function allowance(
        address _owner,
        address _spender
    )
    public
    view
    returns (uint256)
    {
        return allowed[_owner][_spender];
    }

    /**
     * @notice increasing approval on setted amount of tokens
     * @param _spender address of receiver
     * @param _addedValue number of tokens for increasing
     * @return true when operation is successful
     */
    function increaseApproval(
        address _spender,
        uint256 _addedValue
    )
    public
    {
        require(msg.sender != _spender);
        require(allowed[msg.sender][_spender] + _addedValue <= balances[msg.sender]);
        allowed[msg.sender][_spender] += _addedValue;
        emit Approval(msg.sender, _spender, allowed[msg.sender][_spender]);
    }

    /**
     * @notice decreasing approval on setted amount of tokens
     * @param _spender address of receiver
     * @param _subtractedValue number of tokens for decreasing
     * @return true when operation is successful
     */
    function decreaseApproval(
        address _spender,
        uint256 _subtractedValue
    )
    public
    {
        require(msg.sender != _spender);
        uint256 oldValue = allowed[msg.sender][_spender];
        if (_subtractedValue > oldValue) {
            allowed[msg.sender][_spender] = 0;
        } else {
            allowed[msg.sender][_spender] = oldValue - _subtractedValue;
        }
        emit Approval(msg.sender, _spender, allowed[msg.sender][_spender]);
    }
}
