pragma solidity ^0.4.24;

import "./Ownable.sol";
import "./Crowdsale.sol";

contract MultiSigWallet is Ownable {

    /**
     *  Events
     */
    event Confirmation(address indexedSender, uint256 indexedTransactionId);
    event Revocation(address indexedSender, uint256 indexedTransactionId);
    event Submission(uint256 indexedTransactionId);
    event Execution(uint256 indexedTransactionId);
    event ExecutionFailure(uint256 indexedTransactionId);
    event Deposit(address indexedSender, uint256 value);
    event OwnerAddition(address indexedOwner);
    event OwnerRemoval(address indexedOwner);
    event RequirementChange(uint256 required);

    bool isICOCrashed = false;
    bool isICOFinished = false;

    /**
     *  Constants
     */
    uint256 constant public MAX_OWNER_COUNT = 50;

    /**
     *  Storage
     */
    mapping (uint256 => Transaction) public transactions;
    mapping (uint256 => mapping (address => bool)) public confirmations;
    mapping (address => bool) public isOwner;
    address[] public owners;
    Crowdsale public crowdsaleAddress;
    uint256 public required;
    uint256 public transactionCount;

    struct Transaction {
        address destination;
        uint256 value;
        bytes data;
        bool executed;
    }

    /**
     *  Modifiers
     */
    modifier onlyWallet() {
        require(msg.sender == address(this));
        _;
    }

    modifier onlyCrowdsale() {
        require(msg.sender == address(crowdsaleAddress));
        _;
    }

    modifier ownerDoesNotExist(address owner) {
        require(isOwner[owner] == false);
        _;
    }

    modifier ownerExists(address owner) {
        require(isOwner[owner]);
        _;
    }

    modifier transactionExists(uint256 transactionId) {
        require(transactions[transactionId].destination != 0);
        _;
    }

    modifier confirmed(uint256 transactionId, address owner) {
        require(confirmations[transactionId][owner]);
        _;
    }

    modifier notConfirmed(uint256 transactionId, address owner) {
        require(confirmations[transactionId][owner] == false);
        _;
    }

    modifier notExecuted(uint256 transactionId) {
        require(transactions[transactionId].executed == false);
        _;
    }

    modifier notNull(address _address) {
        require(_address != 0);
        _;
    }

    modifier validRequirement(uint256 ownerCount, uint256 _required) {
        require(ownerCount <= MAX_OWNER_COUNT
        && _required <= ownerCount
        && _required != 0
        && ownerCount != 0);
        _;
    }

    /**
      * @dev Fallback function allows to deposit ether.
      */
    function() payable public {
        if (msg.value > 0)
            emit Deposit(msg.sender, msg.value);
    }

    /**
     * Public functions
     */
    /**
      * @dev Contract constructor sets initial owners and required number of confirmations.
      * @param _owners List of initial owners.
      * @param _required Number of required confirmations.
      */
    constructor(address[] _owners, uint256 _required)
    public
    validRequirement(_owners.length, _required)
    {
        for (uint256 i=0; i<_owners.length; i++) {
            require(!isOwner[_owners[i]] && _owners[i] != 0);
            isOwner[_owners[i]] = true;
        }
        owners = _owners;
        required = _required;
    }

    /**
     * @notice function for changing info about status of ICO. ICO is crashed
     */
    function crashCrowd() public onlyCrowdsale {
        isICOCrashed = true;
    }

    /**
     * @notice function for changing info about status of ICO. ICO is finished
     */
    function finishCrowd() public onlyCrowdsale {
        isICOFinished = true;
    }

    function setCrowdsaleAddress(Crowdsale _address) public onlyOwner {
        require(address(crowdsaleAddress) == 0x0);
        crowdsaleAddress = _address;
    }

    /**
     * @notice give back ether of address when ICO is crashed
     * @param _address address of payer
     * @param _value number of ether for transfer
     */
    function refund(address _address, uint256 _value) public onlyCrowdsale {
        require(isICOCrashed);
        _address.transfer(_value);
    }

    /**
      * @dev Allows to add a new owner. Transaction has to be sent by wallet.
      * @param owner Address of new owner.
      */
    function addOwner(address owner)
    public
    onlyWallet
    ownerDoesNotExist(owner)
    notNull(owner)
    validRequirement(owners.length + 1, required)
    {
        isOwner[owner] = true;
        owners.push(owner);
        emit OwnerAddition(owner);
    }

    /**
      * @dev Allows to remove an owner. Transaction has to be sent by wallet.
      * @param owner Address of owner.
      */
    function removeOwner(address owner)
    public
    onlyWallet
    ownerExists(owner)
    {
        isOwner[owner] = false;
        for (uint256 i=0; i<owners.length - 1; i++)
            if (owners[i] == owner) {
                owners[i] = owners[owners.length - 1];
                break;
            }
        owners.length -= 1;
        if (required > owners.length)
            changeRequirement(owners.length);
        emit OwnerRemoval(owner);
    }

    /**
      * @dev Allows to replace an owner with a new owner. Transaction has to be sent by wallet.
      * @param owner Address of owner to be replaced.
      * @param newOwner Address of new owner.
      */
    function replaceOwner(address owner, address newOwner)
    public
    onlyWallet
    ownerExists(owner)
    ownerDoesNotExist(newOwner)
    {
        for (uint256 i=0; i<owners.length; i++)
            if (owners[i] == owner) {
                owners[i] = newOwner;
                break;
            }
        isOwner[owner] = false;
        isOwner[newOwner] = true;
        emit OwnerRemoval(owner);
        emit OwnerAddition(newOwner);
    }

    /**
      * @dev Allows to change the number of required confirmations. Transaction has to be sent by wallet.
      * @param _required Number of required confirmations.
      */
    function changeRequirement(uint256 _required)
    public
    onlyWallet
    validRequirement(owners.length, _required)
    {
        required = _required;
        emit RequirementChange(_required);
    }

    /**
      * @dev Allows an owner to submit and confirm a transaction.
      * @param destination Transaction target address.
      * @param value Transaction ether value.
      * @param data Transaction data payload.
      * @return Returns transaction ID.
      */
    function submitTransaction(address destination, uint256 value, bytes data)
    public
    returns (uint256 transactionId)
    {
        require(isICOFinished);
        transactionId = addTransaction(destination, value, data);
        confirmTransaction(transactionId);
    }

    /**
      * @dev Allows an owner to confirm a transaction.
      * @param transactionId Transaction ID.
      */
    function confirmTransaction(uint256 transactionId)
    public
    ownerExists(msg.sender)
    transactionExists(transactionId)
    notConfirmed(transactionId, msg.sender)
    {
        confirmations[transactionId][msg.sender] = true;
        emit Confirmation(msg.sender, transactionId);
        executeTransaction(transactionId);
    }

    /**
      * @dev Allows an owner to revoke a confirmation for a transaction.
      * @param transactionId Transaction ID.
      */
    function revokeConfirmation(uint256 transactionId)
    public
    ownerExists(msg.sender)
    confirmed(transactionId, msg.sender)
    notExecuted(transactionId)
    {
        confirmations[transactionId][msg.sender] = false;
        emit Revocation(msg.sender, transactionId);
    }

    /**
      * @dev Allows anyone to execute a confirmed transaction.
      * @param transactionId Transaction ID.
      */
    function executeTransaction(uint256 transactionId)
    public
    ownerExists(msg.sender)
    confirmed(transactionId, msg.sender)
    notExecuted(transactionId)
    {
        if (isConfirmed(transactionId)) {
            Transaction storage txn = transactions[transactionId];
            txn.executed = true;
            if (external_call(txn.destination, txn.value, txn.data.length, txn.data))
                emit Execution(transactionId);
            else {
                emit ExecutionFailure(transactionId);
                txn.executed = false;
            }
        }
    }

    /**
      * @notice call has been separated into its own function in order to take advantage
      * of the Solidity's code generator to produce a loop that copies tx.data into memory.
      */
    function external_call(address destination, uint256 value, uint256 dataLength, bytes data) private returns (bool) {
        bool result;
        assembly {
            let x := mload(0x40)   // "Allocate" memory for output (0x40 is where "free memory" pointer is stored by convention)
            let d := add(data, 32) // First 32 bytes are the padded length of data, so exclude that
            result := call(
            sub(gas, 34710),   // 34710 is the value that solidity is currently emitting
            // It includes callGas (700) + callVeryLow (3, to pay for SUB) + callValueTransferGas (9000) +
            // callNewAccountGas (25000, in case the destination address does not exist and needs creating)
            destination,
            value,
            d,
            dataLength,        // Size of the input (in bytes) - this is what fixes the padding problem
            x,
            0                  // Output is ignored, therefore the output size is zero
            )
        }
        return result;
    }

    /**
      * @dev Returns the confirmation status of a transaction.
      * @param transactionId Transaction ID.
      * @return Confirmation status.
      */
    function isConfirmed(uint256 transactionId)
    public
    constant
    returns (bool)
    {
        uint256 count = 0;
        for (uint256 i=0; i<owners.length; i++) {
            if (confirmations[transactionId][owners[i]])
                count += 1;
            if (count == required)
                return true;
        }
    }

    /**
     * Internal functions
     */
    /**
      * @dev Adds a new transaction to the transaction mapping, if transaction does not exist yet.
      * @param destination Transaction target address.
      * @param value Transaction ether value.
      * @param data Transaction data payload.
      * @return Returns transaction ID.
      */
    function addTransaction(address destination, uint256 value, bytes data)
    internal
    notNull(destination)
    returns (uint256 transactionId)
    {
        transactionId = transactionCount;
        transactions[transactionId] = Transaction({
            destination: destination,
            value: value,
            data: data,
            executed: false
            });
        transactionCount += 1;
        emit Submission(transactionId);
    }

    /**
     * Web3 call functions
     */
    /**
      * @dev Returns number of confirmations of a transaction.
      * @param transactionId Transaction ID.
      * @return Number of confirmations.
      */
    function getConfirmationCount(uint256 transactionId)
    public
    constant
    returns (uint256 count)
    {
        for (uint256 i=0; i<owners.length; i++)
            if (confirmations[transactionId][owners[i]])
                count += 1;
    }

    /**
      * @dev Returns total number of transactions after filers are applied.
      * @param pending Include pending transactions.
      * @param executed Include executed transactions.
      * @return Total number of transactions after filters are applied.
      */
    function getTransactionCount(bool pending, bool executed)
    public
    constant
    returns (uint256 count)
    {
        for (uint256 i=0; i<transactionCount; i++)
            if (   pending && !transactions[i].executed
            || executed && transactions[i].executed)
                count += 1;
    }

    /**
      * @dev Returns list of owners.
      * @return List of owner addresses.
      */
    function getOwners()
    public
    constant
    returns (address[])
    {
        return owners;
    }

    /**
      * @dev Returns array with owner addresses, which confirmed transaction.
      * @param transactionId Transaction ID.
      * @return Returns array of owner addresses.
      */
    function getConfirmations(uint256 transactionId)
    public
    constant
    returns (address[] _confirmations)
    {
        address[] memory confirmationsTemp = new address[](owners.length);
        uint256 count = 0;
        uint256 i;
        for (i=0; i<owners.length; i++)
            if (confirmations[transactionId][owners[i]]) {
                confirmationsTemp[count] = owners[i];
                count += 1;
            }
        _confirmations = new address[](count);
        for (i=0; i<count; i++)
            _confirmations[i] = confirmationsTemp[i];
    }

    /**
      * @dev Returns list of transaction IDs in defined range.
      * @param from Index start position of transaction array.
      * @param to Index end position of transaction array.
      * @param pending Include pending transactions.
      * @param executed Include executed transactions.
      * @return Returns array of transaction IDs.
      */
    function getTransactionIds(uint256 from, uint256 to, bool pending, bool executed)
    public
    constant
    returns (uint[] _transactionIds)
    {
        uint[] memory transactionIdsTemp = new uint[](transactionCount);
        uint256 count = 0;
        uint256 i;
        for (i=0; i<transactionCount; i++)
            if (   pending && !transactions[i].executed
            || executed && transactions[i].executed)
            {
                transactionIdsTemp[count] = i;
                count += 1;
            }
        _transactionIds = new uint[](to - from);
        for (i=from; i<to; i++)
            _transactionIds[i - from] = transactionIdsTemp[i];
    }
}