const {assertRevert} = require('./assertRevert');
const common = require('./common');

let ERC20 = artifacts.require('./ERC20BurnMint');
let Crowdsale = artifacts.require('./Crowdsale');
let erc20, crowdsale;

async function travelHundredDays() {
    const one_day = 86400;
    await common.timeTravel(101 * one_day);
    await common.mineBlock();
}

contract('Crowdsale', function(accounts) {
  beforeEach(async() => {
    erc20 = await ERC20.new('autoXchange', 'AUX', 18, {gas: 99999999, from: accounts[0]});
    crowdsale = await Crowdsale.new(accounts[0], 1000, erc20.address, 100, 100, {from: accounts[0]});
    await erc20.setSaleAgent(crowdsale.address, {from: accounts[0]});
    await erc20.setCrowdsaleAddress(crowdsale.address, {from: accounts[0]});
    await crowdsale.init(accounts[5], accounts[6], accounts[7], accounts[8], accounts[9], accounts[9], {from: accounts[0]});
  });
  describe('creation', function() {
    it('creation: correct information', async() => {
        const tokAdd = await crowdsale.token();
        assert.equal(tokAdd, erc20.address, 'token address');

        const walAdd = await crowdsale.multisig();
        assert.equal(walAdd, accounts[0], 'multisig');

        const rate = await crowdsale.rate();
        assert.equal(+rate, 1000, 'rate');
    });
    it('createTokens: creating while pausing', async() => {
        await crowdsale.pauseCrowdsale({from: accounts[0]});
        await assertRevert(crowdsale.createTokens(accounts[0], 1000, {from: accounts[0]}));
    });
    it('crateTokens: pausing from not owner', async() => {
        await assertRevert(crowdsale.pauseCrowdsale({from: accounts[1]}));
    });
    it('crateTokens: create from not owner', async() => {
        await assertRevert(crowdsale.createTokens(accounts[1], 1000, {from: accounts[1]}));
    });
    it('createTokens: creation after hundred days', async() => {
        await travelHundredDays();
        await assertRevert(crowdsale.createTokens(accounts[0], 1000, {from: accounts[0]}));
    });
    it('createTokens: event', async() => {
        const { logs } = await crowdsale.createTokens(accounts[0], 1000, {from: accounts[0]});

        assert.equal(logs.length, 1);
        assert.equal(logs[0].event, 'CreatedTokens');
        assert.equal(logs[0].args.spender, accounts[0]);
        assert.equal(+logs[0].args.value, 1450);
        assert.equal(+logs[0].args.totalTokens, 1450);
    });
  });
  describe('deleteTokens', function() {
    it('deleteTokens: correct bonus', async() => {
        await crowdsale.deleteTokens(100, {from: accounts[0]});

        const balance1 = await erc20.balanceOf("0x0");
        assert.equal(+balance1, 100);

        const total = await crowdsale.totalSupply();
        assert.equal(+total, 100);
    });
    it('deleteTokens: delete from not owner', async() => {
        await assertRevert(crowdsale.deleteTokens(1000, {from: accounts[2]}));
    });
  });
  describe('buyTokens', function() {
    it('buyTokens" correct', async() => {
        await crowdsale.buyTokens({from: accounts[1], value: web3.toWei(1, 'ether')});
        const balance = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance, 1450);
    });
    it('buyTokens: send 0 ether', async() => {
        await assertRevert(crowdsale.buyTokens({from: accounts[1], value: web3.toWei(0, 'ether')}));
    });
  });
  describe('pause/start crowdsale', function() {
    it('pause/start crowdsale: pause', async() => {
        await crowdsale.pauseCrowdsale({from: accounts[0]});
        await assertRevert(crowdsale.createTokens(accounts[1], 1000, {from: accounts[0]}));
    });
    it('pause/start crowdsale: start after pause', async() => {
        await crowdsale.pauseCrowdsale({from: accounts[0]});
        await assertRevert(crowdsale.createTokens(accounts[1], 1000, {from: accounts[0]}));

        await crowdsale.startCrowdsale({from: accounts[0]});
        await crowdsale.createTokens(accounts[0], 1000, {from: accounts[0]});

        const totalSupply = await crowdsale.totalSupply();
        assert.equal(+totalSupply, 1450);
    });
  });
  describe('addPayment', function() {
    it('addPayment: correct adding', async() => {
        await crowdsale.buyTokens({from: accounts[1], value: web3.toWei(1, 'ether')});
        const balance = await erc20.balanceOf(accounts[1]);
        assert.equal(+balance, 1450);

        const payment = await erc20.getPayment(accounts[1]);
        assert.equal(+payment, 1000000000000000000);
    });
  });
});