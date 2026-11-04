# Smart-wallet deposit investigation

## Current state

Public trading is disabled. The minimal #6 deposit experiment is closed after
two wrapped transactions created escrow records without indexed transfers.
Changing the existing escrow alone is not a verified solution.

The latest wrapped transaction is
`0x48ff06edf9d3038bba749a56ec3832d5c73cf399edf099a83e0ab18712b872a8`,
block `26337993`. Its outer target is MetaMask's DelegationManager
`0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3`. Its single inner execution calls
the Trixmoji escrow with #6's ID and zero ETH. The indexer processed that block
and continued to show the owner as `0x47cf60BdD877203264921D05CE26F81f6d36Aa3E`.

The delegation includes a native-balance guard at
`0xbD7B277507723490Cd50b12EaaFe87C616be6880`, identified by Blockscout as
`NativeBalanceChangeEnforcer`.

## Wallet-source finding

MetaMask's current source includes an optional approval feature labelled
**Added protection**, implemented as EnforcedSimulations. Its conversion creates
a `redeemDelegations` call, changes the outer destination and calldata, and adds
native-balance caveats. This matches the shape observed in the failed deposits.
The exact user's release and chosen approval options have not been inspected,
so the feature selection itself is not independently proven from wallet UI.

Sources:

- [Container conversion](https://github.com/MetaMask/metamask-extension/blob/main/app/scripts/lib/transaction/containers/enforced-simulations.ts)
- [Outer transaction updates](https://github.com/MetaMask/metamask-extension/blob/main/app/scripts/lib/transaction/containers/util.ts)
- [Eligibility and address trust](https://github.com/MetaMask/metamask-extension/blob/main/shared/lib/transaction/enforced-simulations.ts)
- [Approval labels](https://github.com/MetaMask/metamask-extension/blob/main/app/_locales/en/messages.json)
- [Ethscriptions transfer requirements](https://docs.ethscriptions.com/overview/protocol-specification)

The site must not silently disable wallet protections or imply that a call to
the escrow transfers an Ethscription when the outer transaction was rewritten.
There is no verified site-controlled switch in this integration that prevents
the wallet from wrapping it. No further paid deposit should be requested until
a wallet-supported standard transaction route is established.

## Reference evidence

An EtherPhunks deposit from another account with the same EIP-7702 delegation
implementation is verified by `dev/clean-pop/verify-reference-deposit.cjs`.
This establishes that delegated account code itself does not rule out direct
transactions. It does not establish this user's wallet approval route.

The existing Trixmoji escrow at
`0xd935E162B6070C4FEAF600c67f7F729f318515a2` was matched exactly on Sourcify on
2026-11-04 (creation and runtime bytecode). No contract was redeployed. This
removes unverified source as a deployment uncertainty, but does not by itself
prove MetaMask will bypass Added Protection for a Dapp transaction.

The restricted #6 test is guarded by current wallet ownership, clean escrow
state, no prior unresolved route or market requests, an exact simulated direct
call, and a user confirmation of the MetaMask transaction details. It only
reports success after receipt, cooldown, escrow storage, and the Ethscriptions
indexer all agree. A wrapped transaction remains explicitly unverified and must
be recovered; it is never treated as a deposit.

The replacement recovery page is restricted to the latest false #6 record and
checks indexed ownership before cancellation and after confirmation. It
requires separate explicit approval and gas. Recovery is not a compatibility
fix and does not reopen trading.
