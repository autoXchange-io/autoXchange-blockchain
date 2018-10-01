const {assertRevert} = require('./assertRevert');

let Multisig = artifacts.require('./MultiSigWallet');
let ERC20 = artifacts.require('./ERC20BurnMint');
let Crowdsale = artifacts.require('./Crowdsale');
let multisig, crowdsale, erc20;

contract('Multisig', function(accounts) {
    beforeEach(async() => {
        erc20 = await ERC20.new('PavleCoin', 'PC', 100, {gas: 99999999, from: accounts[0]});
        multisig = await Multisig.new([accounts[0], accounts[1], accounts[2]], 2, {from: accounts[0]});
        crowdsale = await Crowdsale.new(multisig.address, 1000, erc20.address, 100, 100, {from: accounts[0]});

        await erc20.setSaleAgent(crowdsale.address, {from: accounts[0]});
        await erc20.setCrowdsaleAddress(crowdsale.address, {from: accounts[0]});
        await multisig.setCrowdsaleAddress(crowdsale.address, {from: accounts[0]});
        await crowdsale.init(accounts[5], accounts[6], accounts[7], accounts[8], accounts[9], accounts[9], {from: accounts[0]});

        await web3.eth.sendTransaction({to: multisig.address, value: 1000000000000000000, from: accounts[0]});
    });
    describe('creation', function() {
        it('creation: correct information', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const owners = await multisig.getOwners();
            for(i = 0; i < owners.length; i++) {
                assert.equal(owners[i], accounts[i]);
            }

            const balance = await web3.eth.getBalance(multisig.address);
            assert.equal(+balance, 1000000000000000000);
        });
    });
    describe('addTransaction', function() {
        it('addTransaction: adding transaction', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            await multisig.submitTransaction(multisig.address, 0, "");
            const numberOfTrans = await multisig.getTransactionCount(true, false);
            assert.equal(+numberOfTrans, 1);
        });
        it('addTransaction: add new owner', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const data = multisig.contract.addOwner.getData(accounts[3]);
            await multisig.submitTransaction(multisig.address, 0, data, {from: accounts[0]});

            const owners = await multisig.getOwners();
            await multisig.confirmTransaction(0 , {from: accounts[1]});

            const owners2 = await multisig.getOwners();
            assert.equal(owners2[3], accounts[3]);
        });
        it('addTransactions: add owner not from multisig', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            await assertRevert(multisig.addOwner(accounts[4]));
        });
        it('addTransaction: add existing owner', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const numOfAdmins1 = await multisig.getOwners();
            assert.equal(+numOfAdmins1.length, 3);

            const data = multisig.contract.addOwner.getData(accounts[1]);
            await multisig.submitTransaction(multisig.address, 0, data, {from: accounts[0]});

            await multisig.confirmTransaction(0 , {from: accounts[1]});
            const numOfAdmins = await multisig.getOwners();
            assert.equal(+numOfAdmins.length, 3);
        });
        it('addTransaction: add zero admin', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const numOfAdmins1 = await multisig.getOwners();
            assert.equal(+numOfAdmins1.length, 3);

            const data = multisig.contract.addOwner.getData('0x0', {from: accounts[0]});
            await multisig.submitTransaction(multisig.address, 0, data, {from: accounts[0]});

            await multisig.confirmTransaction(0 , {from: accounts[1]});
            const numOfAdmins = await multisig.getOwners();
            assert.equal(+numOfAdmins.length, 3);
        });
        it('addTransaction: remove owner', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const numOfAdmins1 = await multisig.getOwners();
            assert.equal(+numOfAdmins1.length, 3);

            const data = multisig.contract.removeOwner.getData(accounts[1], {from: accounts[0]});
            await multisig.submitTransaction(multisig.address, 0, data, {from: accounts[0]});

            await multisig.confirmTransaction(0 , {from: accounts[1]});
            const numOfAdmins = await multisig.getOwners();
            assert.equal(+numOfAdmins.length, 2);
        });
        it('addTransactions: remove owner not from multisig', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            await assertRevert(multisig.removeOwner(accounts[1]));
        });
        it('addTransaction: remove unreal owner', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const numOfAdmins1 = await multisig.getOwners();
            assert.equal(+numOfAdmins1.length, 3);

            const data = multisig.contract.removeOwner.getData(accounts[5], {from: accounts[0]});
            await multisig.submitTransaction(multisig.address, 0, data, {from: accounts[0]});

            await multisig.confirmTransaction(0 , {from: accounts[1]});
            const numOfAdmins = await multisig.getOwners();
            assert.equal(+numOfAdmins.length, 3);
        });
        it('addTransaction: replace owner', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const numOfAdmins1 = await multisig.getOwners();
            assert.equal(+numOfAdmins1.length, 3);

            const data = multisig.contract.replaceOwner.getData(accounts[1], accounts[6], {from: accounts[0]});
            await multisig.submitTransaction(multisig.address, 0, data, {from: accounts[0]});

            await multisig.confirmTransaction(0 , {from: accounts[1]});
            const numOfAdmins = await multisig.getOwners();
            assert.equal(+numOfAdmins[1], accounts[6]);
        });
        it('addTransactions: replace owner not from multisig', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            await assertRevert(multisig.replaceOwner(accounts[1], accounts[7]));
        });
        it('addTransaction: replace unreal owner', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const numOfAdmins1 = await multisig.getOwners();
            assert.equal(+numOfAdmins1.length, 3);

            const data = multisig.contract.replaceOwner.getData(accounts[5], accounts[6], {from: accounts[0]});
            await multisig.submitTransaction(multisig.address, 0, data, {from: accounts[0]});

            await multisig.confirmTransaction(0 , {from: accounts[1]});
            const numOfAdmins = await multisig.getOwners();
            for(i = 0; i < numOfAdmins.length; i++) {
                assert.equal(numOfAdmins[i], accounts[i]);
            }
        });
        it('addTransaction: replace to unreal owner', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const numOfAdmins1 = await multisig.getOwners();
            assert.equal(+numOfAdmins1.length, 3);

            const data = multisig.contract.replaceOwner.getData(accounts[1], accounts[2], {from: accounts[0]});
            await multisig.submitTransaction(multisig.address, 0, data, {from: accounts[0]});

            await multisig.confirmTransaction(0 , {from: accounts[1]});
            const numOfAdmins = await multisig.getOwners();
            for(i = 0; i < numOfAdmins.length; i++) {
                assert.equal(numOfAdmins[i], accounts[i]);
            }
        });
        it('addTransaction: change requirement', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const requirement = await multisig.required();
            assert.equal(+requirement, 2);

            const data = multisig.contract.changeRequirement.getData(3, {from: accounts[0]});
            await multisig.submitTransaction(multisig.address, 0, data, {from: accounts[0]});

            await multisig.confirmTransaction(0 , {from: accounts[1]});
            const requirement2 = await multisig.required();
            assert.equal(+requirement2, 3);
        });
        it('addTransactions: change requirement not from multisig', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            await assertRevert(multisig.changeRequirement(8));
        });
        it('addTransaction: remove owner with revoke', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const numOfAdmins1 = await multisig.getOwners();
            assert.equal(+numOfAdmins1.length, 3);

            const data = multisig.contract.removeOwner.getData(accounts[1], {from: accounts[0]});
            await multisig.submitTransaction(multisig.address, 0, data, {from: accounts[0]});

            await multisig.revokeConfirmation(0 , {from: accounts[0]});

            await multisig.confirmTransaction(0 , {from: accounts[1]});
            await multisig.confirmTransaction(0 , {from: accounts[2]});
            const numOfAdmins = await multisig.getOwners();
            assert.equal(+numOfAdmins.length, 2);
        });
        it('addTransaction: remove owner with revoke from unreal owner', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const numOfAdmins1 = await multisig.getOwners();
            assert.equal(+numOfAdmins1.length, 3);

            const data = multisig.contract.removeOwner.getData(accounts[1], {from: accounts[0]});
            await multisig.submitTransaction(multisig.address, 0, data, {from: accounts[0]});

            await assertRevert(multisig.revokeConfirmation(0 , {from: accounts[7]}));

            await multisig.confirmTransaction(0 , {from: accounts[1]});
            const numOfAdmins = await multisig.getOwners();
            assert.equal(+numOfAdmins.length, 2);
        });
        it('addTransaction: remove owner with revoke after transaction', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const numOfAdmins1 = await multisig.getOwners();
            assert.equal(+numOfAdmins1.length, 3);

            const data = multisig.contract.removeOwner.getData(accounts[1], {from: accounts[0]});
            await multisig.submitTransaction(multisig.address, 0, data, {from: accounts[0]});

            await multisig.confirmTransaction(0 , {from: accounts[1]});
            const numOfAdmins = await multisig.getOwners();
            assert.equal(+numOfAdmins.length, 2);

            await assertRevert(multisig.revokeConfirmation(0 , {from: accounts[0]}));
        });
    });
    describe('Event', function() {
        it('Event: Confirmation', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const numOfAdmins1 = await multisig.getOwners();
            assert.equal(+numOfAdmins1.length, 3);

            const data = multisig.contract.removeOwner.getData(accounts[1], {from: accounts[0]});
            await multisig.submitTransaction(multisig.address, 0, data, {from: accounts[0]});
            const { logs } = await multisig.confirmTransaction(0, {from: accounts[1]});


            assert.equal(logs.length, 3);
            assert.equal(logs[0].event, 'Confirmation');
            assert.equal(logs[0].args.indexedSender, accounts[1]);
            assert.equal(+logs[0].args.indexedTransactionId, 0);
        });
        it('Event: OwnerRemoval', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const numOfAdmins1 = await multisig.getOwners();
            assert.equal(+numOfAdmins1.length, 3);

            const data = multisig.contract.removeOwner.getData(accounts[1], {from: accounts[0]});
            await multisig.submitTransaction(multisig.address, 0, data, {from: accounts[0]});
            const { logs } = await multisig.confirmTransaction(0, {from: accounts[1]});


            assert.equal(logs.length, 3);
            assert.equal(logs[1].event, 'OwnerRemoval');
            assert.equal(logs[1].args.indexedOwner, accounts[1]);
        });
        it('Event: Execution', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const numOfAdmins1 = await multisig.getOwners();
            assert.equal(+numOfAdmins1.length, 3);

            const data = multisig.contract.removeOwner.getData(accounts[1], {from: accounts[0]});
            await multisig.submitTransaction(multisig.address, 0, data, {from: accounts[0]});
            const { logs } = await multisig.confirmTransaction(0, {from: accounts[1]});

            assert.equal(logs.length, 3);
            assert.equal(logs[2].event, 'Execution');
            assert.equal(+logs[2].args.indexedTransactionId, 0);
        });
        it('Event: Revocation', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const numOfAdmins1 = await multisig.getOwners();
            assert.equal(+numOfAdmins1.length, 3);

            const data = multisig.contract.removeOwner.getData(accounts[1], {from: accounts[0]});
            await multisig.submitTransaction(multisig.address, 0, data, {from: accounts[0]});

            const { logs } = await multisig.revokeConfirmation(0 , {from: accounts[0]});

            await multisig.confirmTransaction(0 , {from: accounts[1]});
            await multisig.confirmTransaction(0 , {from: accounts[2]});

            assert.equal(logs.length, 1);
            assert.equal(logs[0].event, 'Revocation');
            assert.equal(logs[0].args.indexedSender, accounts[0]);
            assert.equal(logs[0].args.indexedTransactionId, 0);
        });
        it('Event: Submission', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const numOfAdmins1 = await multisig.getOwners();
            assert.equal(+numOfAdmins1.length, 3);

            const data = multisig.contract.removeOwner.getData(accounts[1], {from: accounts[0]});
            const { logs } = await multisig.submitTransaction(multisig.address, 0, data, {from: accounts[0]});
            await multisig.confirmTransaction(0, {from: accounts[1]});

            assert.equal(logs.length, 2);
            assert.equal(logs[0].event, 'Submission');
            assert.equal(logs[0].args.indexedTransactionId, 0);
        });
        it('Event: ExecutionFailure', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const numOfAdmins1 = await multisig.getOwners();
            assert.equal(+numOfAdmins1.length, 3);

            const data = multisig.contract.replaceOwner.getData(accounts[1], accounts[2], {from: accounts[0]});
            await multisig.submitTransaction(multisig.address, 0, data, {from: accounts[0]});

            const { logs } = await multisig.confirmTransaction(0 , {from: accounts[1]});
            const numOfAdmins = await multisig.getOwners();
            for(i = 0; i < numOfAdmins.length; i++) {
                assert.equal(numOfAdmins[i], accounts[i]);
            }

            assert.equal(logs.length, 2);
            assert.equal(logs[1].event, 'ExecutionFailure');
            assert.equal(logs[1].args.indexedTransactionId, 0);
        });
        it('Event: OwnerAddition', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const data = multisig.contract.addOwner.getData(accounts[3]);
            await multisig.submitTransaction(multisig.address, 0, data, {from: accounts[0]});

            const owners = await multisig.getOwners();
            const { logs } = await multisig.confirmTransaction(0 , {from: accounts[1]});

            const owners2 = await multisig.getOwners();
            assert.equal(owners2[3], accounts[3]);

            assert.equal(logs.length, 3);
            assert.equal(logs[1].event, 'OwnerAddition');
            assert.equal(logs[1].args.indexedOwner, accounts[3]);
        });
        it('Event: RequirementChange', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const requirement = await multisig.required();
            assert.equal(+requirement, 2);

            const data = multisig.contract.changeRequirement.getData(3, {from: accounts[0]});
            await multisig.submitTransaction(multisig.address, 0, data, {from: accounts[0]});

            const { logs } = await multisig.confirmTransaction(0 , {from: accounts[1]});
            const requirement2 = await multisig.required();
            assert.equal(+requirement2, 3);

            assert.equal(logs.length, 3);
            assert.equal(logs[1].event, 'RequirementChange');
            assert.equal(logs[1].args.required, 3);
        });
    });
    describe('CrowdsaleAddress', function() {
        it('CrowdsaleAddress: correct address', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const add = await multisig.crowdsaleAddress();
            assert.equal(add, crowdsale.address);
        });

        it('CrowdsaleAddress: changing address', async() => {
            await crowdsale.finishCrowdsale({from: accounts[0]});
            const add = await multisig.crowdsaleAddress();
            assert.equal(add, crowdsale.address);

            await assertRevert(multisig.setCrowdsaleAddress(accounts[0]));
        });
    });
    describe('refund', function() {
        it('refund: correct refund', async() => {
            await crowdsale.buyTokens({from: accounts[1], value: web3.toWei(1, 'ether')});
            const balance = await erc20.balanceOf(accounts[1]);
            assert.equal(+balance, 1450);

            const payment = await erc20.getPayment(accounts[1]);
            assert.equal(+payment, 1000000000000000000);

            await crowdsale.crashCrowdsale({from: accounts[0]});

            await erc20.refund({from: accounts[1]});

            const payment2 = await erc20.getPayment(accounts[1]);
            assert.equal(+payment2, 0);

            const balance1 = await erc20.balanceOf(accounts[1]);
            assert.equal(+balance1, 0);
        });
        it('refund: refund without buying', async() => {
            await crowdsale.crashCrowdsale({from: accounts[0]});

            await assertRevert(erc20.refund({from: accounts[1]}));
        });
        it('refund: refund without crash', async() => {
            await crowdsale.buyTokens({from: accounts[1], value: web3.toWei(1, 'ether')});
            const balance = await erc20.balanceOf(accounts[1]);
            assert.equal(+balance, 1450);

            const payment = await erc20.getPayment(accounts[1]);
            assert.equal(+payment, 1000000000000000000);

            await assertRevert(erc20.refund({from: accounts[1]}));
        });
    });
});