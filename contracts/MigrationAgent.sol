pragma solidity ^0.4.24;

contract MigrationAgent {
    function migrate(address _address, uint256 tokensCount) public;
    function setTotalSupply(uint256) public;
}