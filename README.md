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
- `src/nca.ts` – the neural cellular automaton (model, training, targets)
- `src/lab.ts` – the neural blossom lab UI

## Neural blossoms

The page ends with a lab where each species' flower is grown by a neural cellular automaton (after Mordvintsev et al., *Growing Neural Cellular Automata*, 2020). Every cell on a 32 × 32 grid holds 16 numbers, looks at its 3 × 3 neighbourhood through identity and Sobel filters, runs the same two-layer network, and nudges its own state; half the cells update each step. The network is trained by gradient descent through 40 to 64 unrolled steps, with a sample pool and random wounds so it learns to regenerate.

- Training runs in the browser with TensorFlow.js (WebGL). About 4 steps a second on an Apple laptop; a recognisable flower takes a few hundred steps.
- Shipped weights in `public/weights/*.json` were trained in the same lab and load by default, so visitors see a grown flower at once and can still train from scratch.
- Click the growing flower to wound it and watch it heal. The twelve hidden channels are shown alongside.
- "Hang it on the tree" swaps the tree's built petals for the grown flower.

Dev only: the Vite server accepts `POST /__weights/<species>` and writes the JSON into `public/weights`, which is how the shipped weights were produced.

## Live

https://seedling-95h.pages.dev (Cloudflare Pages, `wrangler pages deploy dist --project-name seedling`).
