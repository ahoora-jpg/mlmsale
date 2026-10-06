# Company catalog expansion — 2026-10-06

MLM Sale now has separate company routes for Arya, Newsha, PMLM, LIA Team and BIZ. Badran is excluded. Existing Arya product/category URLs, seller accounts and booth persistence are preserved. Prices appear in seller booths, not company/product catalogs.

## Source coverage

- Arya: 16 existing products; original URLs and imagery preserved. Prior audit limitations about ingredient backgrounds still apply.
- Newsha: 118 product links retrieved from ten linked categories at https://newshanik.ir/. Original packaging photos and available consumption-guide images are used. Excerpts link to each source page. This is retrieved coverage, not a guarantee of inventory completeness or efficacy. Twenty-eight records have no extracted ingredient list; 21 have no consumption-guide image. Missing fields were not invented.
- PMLM: https://pmlm.ir/ returned a hosting security challenge. Products/logo remain pending.
- BIZ: https://bizmlm.ir/ returned a hosting security challenge. Products/logo remain pending.
- LIA Team: https://liateam.com/ failed certificate validation because the certificate was expired. Validation was not bypassed. Products/logo remain pending.

Empty company pages show a preparation state, use noindex and are excluded from the sitemap. Arya green and PMLM purple follow the user direction; remaining palettes are provisional until verified brand specifications are available. Company text is used instead of fabricated logos when an original logo has not been obtained. Firecrawl retrieval was unavailable due to insufficient account credits; direct source retrieval supplied Newsha data. Raw source HTML and private account information are excluded from public assets and this report.

## Validation

Build and Worker deployment dry-run passed for 134 products and their assets. All five integration tests passed: catalog SSR/canonical/robots/404s, owner login and public-data redaction, registration and ownership, storage/session persistence across restart, and login throttling. Direct SSR validation additionally passed for all 134 product URLs and five company routes. JavaScript syntax and Git whitespace checks passed.

Browser preview creation timed out, so completed visual/mobile QA is not claimed. Production deployment is not established by a dry-run; live status must be checked separately after publishing.
