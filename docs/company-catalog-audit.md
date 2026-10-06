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

## Access recovery and expansion — 2026-10-06

The previous commit bcf7a61 is confirmed on GitHub and the production homepage now contains five company links. Source research found the accessible LIA Team site at https://liateam.ir/ instead of the expired .com host. Its original header SVG logo was copied unchanged. Of 226 discovered product links, 110 products with retrievable source photos were imported; 116 fetches failed with HTTP 404. This is not a complete inventory claim. Seventy LIA records have a retrieved description excerpt and seven have an explicit extracted ingredient field; missing composition is not inferred.

PMLM's manufacturer host still returns a security challenge. Thirty-eight L'DORA products were retrieved from the public MyLedora shop (https://www.myledora.ir/shop/), clearly attributed as a retailer source. This covers L'DORA items at that source, not all PMLM brands/products. Its company logo remains pending because available original/secondary downloads failed; the category uses its company name.

BIZ's manufacturer host still returns a security challenge. The public BIZ Plus shop (https://biz-plus.ir/shop/) supplied 120 records. Two unverified medical keyword aliases were excluded, leaving 118 records, with source attribution and no retailer prices, testimonials or seller contact details copied. Description excerpts are attributed retailer claims rather than independently verified efficacy. The BIZ logo was obtained from https://werdsa.com/assets/img/pages/RPTAzMuFCLGRXjGs.jpg and visually inspected: the image reads BIZ and the company name. This is a secondary logo source, not proof of the latest official brand specifications.

The catalog now contains 400 products: Arya 16, Newsha 118, LIA Team 110, PMLM 38, BIZ 118. Company catalog notes disclose incomplete verification against manufacturer catalogs for retailer-sourced sections. The final Worker build/dry-run, image signature check and all five integration tests passed after logo/theme/source-note changes, including adding a LIA product to a seller booth. Browser inventory/preview still failed and Chrome was unavailable through the browser tool; no completed visual/mobile QA is claimed.

All 110 LIA product photos were replaced with the 640px variants explicitly offered in each manufacturer page's image srcset. These are the same source photos served by LIA's own image endpoint, not generated/editing variants. This saved 71,372,620 bytes relative to the original downloaded files. Packaging/ingredient imagery was not fabricated.
