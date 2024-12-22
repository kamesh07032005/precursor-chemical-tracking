class Block {
    constructor(timestamp, data, previousHash = '') {
        this.timestamp = timestamp;
        this.data = data;
        this.previousHash = previousHash;
        this.hash = this.calculateHash();
        this.nonce = 0;
    }

    calculateHash() {
        return CryptoJS.SHA256(
            this.previousHash + 
            this.timestamp + 
            JSON.stringify(this.data) + 
            this.nonce
        ).toString();
    }

    mineBlock(difficulty) {
        while (this.hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")) {
            this.nonce++;
            this.hash = this.calculateHash();
        }
        console.log("Block mined: " + this.hash);
    }
}

class ChemicalBlockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()];
        this.difficulty = 2;
        this.pendingTransactions = [];
    }

    createGenesisBlock() {
        return new Block(Date.now(), { message: "Genesis Block" }, "0");
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    addTransaction(transaction) {
        // Add basic validation
        if (!transaction.companyId || !transaction.chemicalType || !transaction.quantity) {
            throw new Error('Transaction must include companyId, chemicalType, and quantity');
        }

        // Add transaction to pending transactions
        this.pendingTransactions.push({
            ...transaction,
            timestamp: Date.now()
        });
    }

    minePendingTransactions() {
        // Create new block with all pending transactions
        const block = new Block(
            Date.now(),
            this.pendingTransactions,
            this.getLatestBlock().hash
        );

        // Mine the block
        block.mineBlock(this.difficulty);

        // Add block to chain
        this.chain.push(block);

        // Reset pending transactions
        this.pendingTransactions = [];

        return block;
    }

    isChainValid() {
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            // Verify current block's hash
            if (currentBlock.hash !== currentBlock.calculateHash()) {
                return false;
            }

            // Verify link to previous block
            if (currentBlock.previousHash !== previousBlock.hash) {
                return false;
            }
        }
        return true;
    }

    getTransactionHistory(companyId) {
        let transactions = [];
        for (const block of this.chain) {
            if (Array.isArray(block.data)) {
                transactions = transactions.concat(
                    block.data.filter(tx => tx.companyId === companyId)
                );
            }
        }
        return transactions;
    }

    // Save blockchain state to localStorage
    saveState() {
        localStorage.setItem('blockchainState', JSON.stringify({
            chain: this.chain,
            pendingTransactions: this.pendingTransactions,
            difficulty: this.difficulty
        }));
    }

    // Load blockchain state from localStorage
    loadState() {
        const state = localStorage.getItem('blockchainState');
        if (state) {
            const { chain, pendingTransactions, difficulty } = JSON.parse(state);
            this.chain = chain;
            this.pendingTransactions = pendingTransactions;
            this.difficulty = difficulty;
        }
    }
}

// Initialize blockchain
const chemicalBlockchain = new ChemicalBlockchain();

// Load existing state if available
chemicalBlockchain.loadState();

// Example of recording a chemical transaction
function recordChemicalTransaction(transaction) {
    try {
        chemicalBlockchain.addTransaction(transaction);
        const newBlock = chemicalBlockchain.minePendingTransactions();
        chemicalBlockchain.saveState();
        return newBlock;
    } catch (error) {
        console.error('Error recording transaction:', error);
        throw error;
    }
}
