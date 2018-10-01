pragma solidity ^0.4.24;

contract Ownable {
    /**
     * @notice map for list of owners
     */ 
    mapping(address => uint256) public owner;
    uint256 index = 0;

    /**
     * @notice constructor, where first user is an administrator
     */ 
    constructor() public {
        owner[msg.sender] = ++index;
    }

    /**
     * @notice modifier which check the status of user and continue only if msg.sender is administrator
     */ 
    modifier onlyOwner() {
        require(owner[msg.sender] > 0, "onlyOwner exception");
        _;
    }

    /**
     * @notice adding new owner to list of owners
     * @param newOwner address of new administrator
     * @return true when operation is successful
     */ 
    function addNewOwner(address newOwner) public onlyOwner returns(bool) {
        owner[newOwner] = ++index;
        return true;
    }
}
