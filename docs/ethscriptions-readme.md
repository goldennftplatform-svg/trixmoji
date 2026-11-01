# ETHSCRIPTIONS — how to launch a collection

Live on doswapz.com. The same steps are on the site at `/docs/ethscriptions.html` and in Legal §15C.

Escrow, the same ETH address as E.K.: `0x15e85a85B7026875d3529EF0c6de2723C285DA11`

The page does not inscribe the art, does not ask for a seed or a key, and does not sign the escrow wallet. You pay your own gas.

## What you do

1. Log in on Account and add the Ethereum wallet you will use. Every lock has to come from that wallet.
2. Create each ethscription in that wallet. The transaction data starts with `data:`. The ethscription id is that transaction hash.
3. On ETHSCRIPTIONS, fill in Launch. Name is 1 to 32 characters. Symbol is 1 to 10 letters or numbers. Supply is 1 to 10,000. Mint price is 0.0002 to 100 ETH. Max per wallet is 1 to 20. Pick the resale royalty. Click Launch it. Keep the collection id.
4. Send each piece to the escrow address with 0 ETH. The hex data is only the ethscription id.
5. Paste the collection id, the ethscription id, and the lock transaction. Click Deposit it.
6. A buyer logs in, connects that wallet, opens the collection, and clicks Mint. The mint is random. The cover is blank. The buyer pays the mint price to escrow with empty hex data.
7. The escrow wallet sends the piece to the buyer and the creator share to the creator. The page checks those transactions. It cannot sign them. The picture is revealed when the piece reaches the buyer’s wallet.

## TRIXMOJI PHUNKS

The collection preview is visible while purchases are paused. When enabled, buyers select blank covers, connect an Ethereum wallet, review gas, and approve one direct mint per piece. The contract creates the Ethscription for the buyer and splits payment in that same transaction. The site reveals the piece after receipt and indexer verification. Saved transactions can be checked again without paying twice, including when new purchases are paused.

Deployment, configuration, tests, artwork audit, and known limitations: [Phunks launch notes](phunk-launch.md). The site reveal does not hide already-public artwork URLs or on-chain content.

## Fees

- Mint: the buyer pays the mint price. The creator receives 99.5%. DOSWAPZ keeps 0.5% in escrow.
- Resale, default: the price includes 2.5% for the creator. The buyer pays that price. The seller receives 97.5%. DOSWAPZ takes 0.
- Resale, if the creator chose 5% at launch or on the creator's own first listing: the seller still receives the ask. The buyer pays the ask plus 5.5%. The creator receives 5%. DOSWAPZ keeps 0.5% in escrow. A later seller cannot change this.
- A refund returns the piece to the seller and the full amount the buyer paid to the buyer.

## Views

The market page has Collections, Market, My collection, Activity, and Create. My collection needs the account login. It shows collections you launched, pieces already in your wallet, pieces you paid for that are still blank, and pieces you listed.

## After launch

Close deposits stops new pieces. Pieces already in escrow can still be minted. Before anyone pays, escrow can send a piece back to the creator. The page checks that return.
