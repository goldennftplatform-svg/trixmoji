# TrixMoji deposit route evidence

The same wallet and replacement escrow have a proven successful transfer for
the previous collection: transaction
`0x1224a9def0758116e27bed929d68943e617a393eab10c187dad99dc4ecb14eea`
at block 26371526. Its outer transaction is from
`0x47cf60BdD877203264921D05CE26F81f6d36Aa3E` directly to escrow
`0x21c1A938d06f87A039abfC48d1cCB459f55b1685`, with zero value and exactly
the 32-byte Ethscription ID as calldata. The indexer records that transfer and
the prior collection asset remains indexed to escrow.

The new collection #2 deposit
`0xd908efe7044911d8c368a0a998d3ace3d36a359c86b9998b40ffcece74e61cb4`
was instead sent to MetaMask's DelegationManager. The escrow recorded the
inner call, but the indexer did not transfer custody. Cancellation
`0x99c2fda0b421b81a0eae8e70753b6acbf6844eed3bd7c08d32cbdcb78eea0627`
cleared the false record. Indexed ownership must still be checked live.

The user subsequently identified Rabby as the wallet used for the successful
prior deposit and reported that they listed, sold and bought with it. The chain
transaction confirms the successful direct deposit, but cannot itself identify
the wallet application or prove that all future Rabby submissions will be direct.
The site
already requests a direct transaction. Changing application payload fields or
the image root is not demonstrated to prevent wallet-side rewriting. Keep
the affected account's deposit guard for providers other than Rabby, and verify
the outer transaction and indexer after any Rabby submission. Never treat the
wrapped receipt as custody proof.
