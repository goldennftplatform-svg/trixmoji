ATTIC RETAILER ADAPTERS — LAUNCH PREP
=====================================

Files:
  index.js     registry + stubs (active)
  (future)     walmart.js, target.js, bestbuy.js, dicks.js, pokemoncenter.js

Rules before implementing a real check():
  1. Only hit URLs / SKUs on the watchlist (no site-wide crawl).
  2. Respect rate limits; use pollSecondsHot / pollSecondsCold from watchlist.
  3. Return one of: live | preorder | upcoming | soldout | unknown
  4. Set implemented: true only when network logic is real and tested.
  5. Never enable ATTIC_DROPS_LIVE=1 in production until at least one
     adapter is implemented and admin secret is set.

Suggested first real adapter: pokemoncenter (often simpler than Walmart).
