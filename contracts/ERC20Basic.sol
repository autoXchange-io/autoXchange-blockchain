pragma solidity ^0.4.24;

/**
 * interface with main functions of ERC20
 */ 
contract ERC20Basic {
    
    /**
     * @notice getting the balance of user by address
     * @param _owner address of the wallet owner
     * @return uint256 the number of tokens on the wallet
     */     
    function balanceOf(address _owner) public view returns (uint256);
  
    /**
     * function for transfer tokens from address[0] to another user
     * @param to address of receiver
     * @param value amount of tokens for transfer
     * @return true when operation is successful
     */  
    function transfer(address to, uint256 value) public;
    
    /**
     * function returns the number of tokens which another user or contract can recieve from token master
     * @param owner address of sender
     * @param spender address of spender
     * @return uint256 the amount of tokens which spender can take from sender's wallet 
     */ 
    function allowance(address owner, address spender)
      public view returns (uint256);

    /**
     * function transfer the authorized number of tokens from owner of tokens to spender
     * @param from address from which tokens will write off
     * @param to address of receiver of tokens
     * @param value amount of tokens for transfer
     * @return true when operation is successful
     */ 
    function transferFrom(address from, address to, uint256 value)
      public;

    /**
     * function sets the number of tokens which spender can transfer from users wallet
     * @param spender address of user who want take tokens
     * @param value amount of tokens for transfer
     * @return true when operation is successful
     */  
    function approve(address spender, uint256 value) public;
    
    event Approval(
      address indexed owner,
      address indexed spender,
      uint256 value
    );
    
    event Transfer(address indexedFrom, address indexedTo, uint256 value);
}