# TrixMoji launch artwork candidate

This directory is a separate candidate generated from the artist's corrected
`assets-v2.zip` artwork. Images are resized from 3840 × 3840 to 768 × 768
using Lanczos; resizing changes pixels. The resized result is encoded as
lossless WebP and each file is decoded and checked against its resized source.

The metadata copies set `seller_fee_basis_points` to 250, as requested, while
preserving the other artist-provided fields. Nothing in this directory changes
an existing mint, escrow, artwork collection, or on-chain token.

This candidate is not approved for minting until the full set, root, mint
terms, uniqueness and compatibility checks have been reviewed.
