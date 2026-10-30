# Seedling

Plant a seed and watch it grow. A browser time-lapse where every tree is different.

Pick a seed from the shelf (magnolia, mango, apple, cherry blossom, strawberry), drop it in the soil, and watch a year pass: sprout, branches, leaves, blossom, fruit, autumn. Scrub the timeline, change the speed, orbit the camera, and copy a link that regrows the exact same tree for someone else.

## How it works

- **Branches** grow by space colonization. The crown is seeded as a cloud of "light points". Each day every point pulls on the nearest branch tip, the tip grows one step toward the average pull, and points close enough to a branch are spent. Toggle "Show the light" to see the cloud.
- **Thickness** follows the pipe model: a branch is as wide as the square root of the number of segments it feeds, so the trunk needs no special rule.
- **Seasons** are per-species calendars: when leaves open, when blossom opens and falls, when fruit sets and ripens, when leaves turn.
- **Determinism**: the whole lifetime is simulated up front from a seed number, so the timeline can be scrubbed backward and a URL reproduces the tree exactly.

Rendering is three.js with instanced meshes (branches, joints, leaves, blossoms, fruit), soft shadows, and a tiny point-sprite shader for the light.

## Run

```bash
pnpm install
pnpm dev
```

Opens on http://localhost:5195. `pnpm build` produces a static site in `dist/` that deploys anywhere (Cloudflare Pages, GitHub Pages).

## Layout

- `src/growth.ts` – the growth engine (space colonization, deterministic, precomputed lifetime)
- `src/species.ts` – the five species and their calendars
- `src/tree3d.ts` – instanced renderer that answers "what does the plant look like on day d?"
- `src/scene.ts` – lights, ground, camera framing
- `src/explainer.ts` – the three 2D diagrams on the page
- `src/main.ts` – shelf, timeline, share links

## Next

Neural blossoms: replace the drawn flowers with neural cellular automata that learn to grow each species' flower from a single cell and regrow when damaged.
