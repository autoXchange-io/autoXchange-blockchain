const {assertRevert} = require('./assertRevert');
const common = require('./common');

let ERC20 = artifacts.require('./ERC20BurnMint');
let erc20;

async function makeTransferAvailable(accounts) {
    const one_day = 86400;
    const hundredDays = Date.now() / 1000 + 100 * one_day;
    await erc20.setTimeUnlock(hundredDays, hundredDays, hundredDays);
    await common.timeTravel(101 * one_day);
    await common.mineBlock();
}

contract('ERC20', function(accounts) {
  beforeEach(async() => {
      erc20 = await ERC20.new('PavleCoin', 'PC', 100, {gas: 99999999, from: accounts[0]});
      await erc20.setSaleAgent(accounts[0]);
      await erc20.setCrowdsaleAddress(accounts[0], {from: accounts[0]});
      await erc20.crashCrowd({from: accounts[0]});
  });

  describe('creation', function(){
    it('creation: correct name of token', async() => {
        const name = await erc20.name();
        assert.equal(name, "PavleCoin");
    });
    it('creation: correct short name of token', async() => {
        const symbol = await erc20.symbol();
        assert.equal(symbol, "PC");
    });
    it('creationStage: correct decimals', async() => {
        const totalSupply = await erc20.decimals();
        assert.equal(+totalSupply, 100);
    });
  });
  describe('mint', function() {
      it('mint: mint 1000 tokens', async() => {
        await erc20.mint(accounts[1], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance, 1000);
      });
      it('mint: mint tokens from not owner', async() => {
        await assertRevert(erc20.mint(accounts[1], 1000, {from: accounts[1]}));
      });
      it('mint: total supply', async() => {
        await erc20.mint(accounts[1], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance, 1000);

        const supply = await erc20.totalSupply();
        assert.equal(+supply, 1000);
      });
      it('mint: mint event', async() => {
        const { logs } = await erc20.mint(accounts[1], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance, 1000);

        assert.equal(logs.length, 1);
        assert.equal(logs[0].event, 'Mint');
        assert.equal(logs[0].args.indexedTo, accounts[1]);
        assert.equal(+logs[0].args.amount, 1000);
      });
  });
  describe('burn', function() {
      it('burn: burn 1000 tokens', async() => {
        await erc20.mint(accounts[1], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance, 1000);

        await erc20.burn({from: accounts[1]});
        const balance1 = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance1, 0);
      });
      it('burn: burn event', async() => {
        await erc20.mint(accounts[1], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance, 1000);

        const { logs } = await erc20.burn({from: accounts[1]});
        const balance1 = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance1, 0);

        assert.equal(logs.length, 1);
        assert.equal(logs[0].event, 'Burn');
        assert.equal(logs[0].args.indexedBurner, accounts[1]);
        assert.equal(+logs[0].args.value, 1000);
      });
  });
  describe('transfer', function() {
      it('transfer: transfer 1000 tokens to accounts[2]', async() => {
       await erc20.mint(accounts[1], 1000, {from: accounts[0]});
        await makeTransferAvailable(accounts);
        const balance = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance, 1000);

        await erc20.transfer(accounts[2], 100, {from: accounts[1]});
        await erc20.transfer(accounts[2], 100, {from: accounts[1]});
        const balance1 = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance1, 800);

        const balance2 = await erc20.balanceOf(accounts[2]);
        assert.equal(+balance2, 200);
      });
      it('transfer: transfer event', async() => {
        transferEvent = await erc20.Transfer({});

        await makeTransferAvailable(accounts);
        await erc20.mint(accounts[1], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance, 1000);

        const { logs } = await erc20.transfer(accounts[2], 1000, {from: accounts[1]});

        const balance1 = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance1, 0);

        const balance2 = await erc20.balanceOf(accounts[2]);
        assert.equal(+balance2, 1000);

        assert.equal(logs.length, 1);
        assert.equal(logs[0].event, 'Transfer');
        assert.equal(logs[0].args.indexedFrom, accounts[1]);
        assert.equal(logs[0].args.indexedTo, accounts[2]);
        assert.equal(+logs[0].args.value, 1000);
      });
      it('transfer: transfer before unlock', async() => {
        await erc20.mint(accounts[1], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance, 1000);

        await assertRevert(erc20.transfer(accounts[1], 1000, {from: accounts[1]}));
      });
      it('transfer: transfer more, than on balance', async() => {
        await makeTransferAvailable(accounts);
        await erc20.mint(accounts[1], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance, 1000);

        await assertRevert(erc20.transfer(accounts[1], 10000, {from: accounts[1]}));
      });
      it('transfer: transfer without balance', async() => {
        await makeTransferAvailable(accounts);
        await assertRevert(erc20.transfer(accounts[1], 10000, {from: accounts[1]}));
      });
      it('transfer: ether transfer reverted', async() => {
        await makeTransferAvailable(accounts);
        await assertRevert(new Promise((resolve, reject) => {
            web3.eth.sendTransaction({from: accounts[0], to: erc20.address, value: web3.toWei('1', 'Ether')}, (err, res) => {
              if(err) { reject(err);}
              resolve(res);
            });
        }));
      });
      it('transfer: send to itself', async() => {
        await makeTransferAvailable(accounts);
        await erc20.mint(accounts[1], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance, 1000);

        await assertRevert(erc20.transfer(accounts[1], 1000, {from: accounts[1]}));
      });
      it('transfer: send to 0x0 address', async() => {
        await makeTransferAvailable(accounts);
        await erc20.mint(accounts[1], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance, 1000);

        await (erc20.transfer(0x0000000000000000000000000000000000000000, 1000, {from: accounts[1]}));
        const balance2 = await erc20.balanceOf(0x0000000000000000000000000000000000000000);
        assert.equal(+balance2, 1000);
      });
  });
  describe('approve', function() {
      it('approve: correct approve', async() => {
        await erc20.mint(accounts[0], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[0]);
        assert.equal(+balance, 1000);

        await erc20.approve(accounts[1], 1000, {from: accounts[0]});
        const allowance = await erc20.allowance(accounts[0], accounts[1], {from: accounts[0]});
        assert.equal(+allowance, 1000);
      });
      it('approve: approve amount more than on the balance', async() => {
        await erc20.mint(accounts[0], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[0]);
        assert.equal(+balance, 1000);

        await assertRevert(erc20.approve(accounts[1], 10000, {from: accounts[0]}));
      });
      it('approve: approve to itself', async() => {
        await erc20.mint(accounts[0], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[0]);
        assert.equal(+balance, 1000);

        await assertRevert(erc20.approve(accounts[0], 1000, {from: accounts[0]}));
      });
      it('approve: increase approval', async() => {
        await erc20.mint(accounts[0], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[0]);
        assert.equal(+balance, 1000);

        await erc20.approve(accounts[1], 100, {from: accounts[0]});
        const allowance = await erc20.allowance(accounts[0], accounts[1], {from: accounts[0]});
        assert.equal(+allowance, 100);

        await erc20.increaseApproval(accounts[1], 800, {from: accounts[0]});
        const allowance2 = await erc20.allowance(accounts[0], accounts[1], {from: accounts[0]});
        assert.equal(+allowance2, 900);
      });
      it('approve: increase approval more, than on balance', async() => {
        await erc20.mint(accounts[0], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[0]);
        assert.equal(+balance, 1000);

        await erc20.approve(accounts[1], 1000, {from: accounts[0]});
        const allowance = await erc20.allowance(accounts[0], accounts[1], {from: accounts[0]});
        assert.equal(+allowance, 1000);

        await assertRevert(erc20.increaseApproval(accounts[1], 800, {from: accounts[0]}));
      });
      it('approve: increase approval for itself', async() => {
        await erc20.mint(accounts[0], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[0]);
        assert.equal(+balance, 1000);

        await assertRevert(erc20.increaseApproval(accounts[0], 800, {from: accounts[0]}));
      });
      it('approve: decrease approval', async() => {
        await erc20.mint(accounts[0], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[0]);
        assert.equal(+balance, 1000);

        await erc20.approve(accounts[1], 100, {from: accounts[0]});
        const allowance = await erc20.allowance(accounts[0], accounts[1], {from: accounts[0]});
        assert.equal(+allowance, 100);

        await erc20.decreaseApproval(accounts[1], 50, {from: accounts[0]});
        const allowance2 = await erc20.allowance(accounts[0], accounts[1], {from: accounts[0]});
        assert.equal(+allowance2, 50);
      });
      it('approve: decrease approval on amount more, than on balance', async() => {
        await erc20.mint(accounts[0], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[0]);
        assert.equal(+balance, 1000);

        await erc20.approve(accounts[1], 100, {from: accounts[0]});
        const allowance = await erc20.allowance(accounts[0], accounts[1], {from: accounts[0]});
        assert.equal(+allowance, 100);

        await erc20.decreaseApproval(accounts[1], 500, {from: accounts[0]});
        const allowance2 = await erc20.allowance(accounts[0], accounts[1], {from: accounts[0]});
        assert.equal(+allowance2, 0);
      });
      it('approve: decrease approval for itself', async() => {
        await erc20.mint(accounts[0], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[0]);
        assert.equal(+balance, 1000);

        await erc20.approve(accounts[1], 1000, {from: accounts[0]});
        const allowance = await erc20.allowance(accounts[0], accounts[1], {from: accounts[0]});
        assert.equal(+allowance, 1000);

        await assertRevert(erc20.decreaseApproval(accounts[0], 800, {from: accounts[0]}));
      });
  });
  describe('transferFrom', function() {
      it('transferFrom: correct transfer', async() => {
        await makeTransferAvailable(accounts);
        await erc20.mint(accounts[1], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance, 1000);

        await erc20.approve(accounts[2], 1000, {from: accounts[1]});
        const allowance = await erc20.allowance(accounts[1], accounts[2], {from: accounts[1]});
        assert.equal(+allowance, 1000);

        await erc20.transferFrom(accounts[1], accounts[2], 1000, {from: accounts[2]});
        const balance2 = await erc20.balanceOf(accounts[2]);
        assert.equal(+balance2, 1000);
      });
      it('transferFrom: transferFrom event', async() => {
        await makeTransferAvailable(accounts);
        await erc20.mint(accounts[1], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance, 1000);

        await erc20.approve(accounts[2], 1000, {from: accounts[1]});
        const allowance = await erc20.allowance(accounts[1], accounts[2], {from: accounts[1]});
        assert.equal(+allowance, 1000);

        const { logs } = await erc20.transferFrom(accounts[1], accounts[2], 1000, {from: accounts[2]});
        const balance2 = await erc20.balanceOf(accounts[2]);
        assert.equal(+balance2, 1000);

        assert.equal(logs.length, 1);
        assert.equal(logs[0].event, 'Transfer');
        assert.equal(logs[0].args.indexedFrom, accounts[1]);
        assert.equal(logs[0].args.indexedTo, accounts[2]);
        assert.equal(+logs[0].args.value, 1000);
      });
      it('transferFrom: correct transfer from accounts[3]', async() => {
        await makeTransferAvailable(accounts);
        await erc20.mint(accounts[1], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance, 1000);

        await erc20.approve(accounts[2], 1000, {from: accounts[1]});
        const allowance = await erc20.allowance(accounts[1], accounts[2], {from: accounts[1]});
        assert.equal(+allowance, 1000);

        await erc20.transferFrom(accounts[1], accounts[2], 1000, {from: accounts[3]});
        const bal = await erc20.balanceOf(accounts[2]);
        assert.equal(bal, 1000);
      });
      it('transferFrom: transfer more, than allowed', async() => {
        await makeTransferAvailable(accounts);
        await erc20.mint(accounts[1], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance, 1000);

        await erc20.approve(accounts[2], 100, {from: accounts[1]});
        const allowance = await erc20.allowance(accounts[1], accounts[2], {from: accounts[1]});
        assert.equal(+allowance, 100);

        await assertRevert(erc20.transferFrom(accounts[1], accounts[2], 1000, {from: accounts[2]}));
      });
      it('transferFrom: transfer without approve', async() => {
        await makeTransferAvailable(accounts);
        await erc20.mint(accounts[1], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance, 1000);

        await assertRevert(erc20.transferFrom(accounts[1], accounts[2], 1000, {from: accounts[2]}));
      });
      it('transferFrom: transfer to 0x0 address', async() => {
        await makeTransferAvailable(accounts);
        await erc20.mint(accounts[1], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance, 1000);

        await erc20.approve(0x0000000000000000000000000000000000000000, 100, {from: accounts[1]});
        const allowance = await erc20.allowance(accounts[1], 0x0000000000000000000000000000000000000000, {from: accounts[1]});
        assert.equal(+allowance, 100);

        await assertRevert(erc20.transferFrom(accounts[1], 0x0000000000000000000000000000000000000000, 1000, {from: accounts[2]}));
      });
      it('transferFrom: transfer before unlock', async() => {
        await erc20.mint(accounts[1], 1000, {from: accounts[0]});
        const balance = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance, 1000);

        await erc20.approve(accounts[2], 100, {from: accounts[1]});
        const allowance = await erc20.allowance(accounts[1], accounts[2], {from: accounts[1]});
        assert.equal(+allowance, 100);

        await assertRevert(erc20.transferFrom(accounts[1], accounts[2], 100, {from: accounts[2]}));
      });
  });
  describe('setSaleAgent', function() {
    it('setSaleAgent: correct', async() => {
        const agent = await erc20.saleAgent();
        assert.equal(agent, accounts[0]);
    });
    it('setSaleAgent: set second time', async() => {
        const agent = await erc20.saleAgent();
        assert.equal(agent, accounts[0]);

        await assertRevert(erc20.setSaleAgent(accounts[5]));
    });
  });
  describe('setTimeUnlock', function() {
    it('setTimeUnlock: correct', async() => {
        const time = await erc20.timeUnlock();
        assert.equal(time, 9999999999999);

        await erc20.setTimeUnlock(100, 100, 100);
        const time2 = await erc20.timeUnlock();
        assert.equal(time2, 100);
    });
    it('setTimeUnlock: set time twice', async() => {
        const time = await erc20.timeUnlock();
        assert.equal(time, 9999999999999);

        await erc20.setTimeUnlock(100, 100, 100);
        const time2 = await erc20.timeUnlock();
        assert.equal(time2, 100);

        await assertRevert(erc20.setTimeUnlock(192, 192, 192));
    });
  });
});