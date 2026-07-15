# AnShow External Delivery Todo

This file tracks deliverables that require an external service or runtime unavailable to the implementation environment. Product features and code work do not belong here.

## Production Image Set

Status: **generated and verified locally**

The public site now serves the generated, hashed AVIF/WebP derivatives. Do not substitute stock logos, fake customer evidence, fake AnShow operations, embedded text, or watermarked images.

### Source Masters

- Generate all 23 prompts in `content/assets/prompts.json`.
- Save each approved landscape master as `assets/source/<id>.png`.
- Generate separate portrait compositions for `hero-ocean`, `hero-air`, `hero-rail`, and `hero-road`.
- Save portrait masters as `assets/source/<id>-mobile.png`.
- Reject third-party branding, readable private documents, implausible equipment, unsafe cargo handling, and documentary claims about AnShow.

### Processing And Verification

Run from the repository root after all 27 masters are present:

```bash
pnpm assets:build
pnpm assets:verify
```

Required budgets:

- Desktop hero derivative: at most 280 KB
- Mobile hero derivative: at most 140 KB
- Content derivative: at most 90 KB
- Thumbnail derivative: at most 35 KB

Expected result: `content/assets/manifest.json` contains 23 complete records and `frontend/public/media/` contains only referenced hashed AVIF/WebP derivatives.

### Final Visual Check

- Inspect all four hero crops at 375, 768, 1024, and 1440 px.
- Confirm HTML copy remains readable without baking text into images.
- Run the public Playwright suite and verify zero horizontal overflow and zero Axe violations.
- Confirm mobile still requests no Three.js route-scene chunk.
