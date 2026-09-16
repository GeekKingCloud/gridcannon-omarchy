import test from "node:test";
import assert from "node:assert/strict";
import {
  deck,
  shuffle,
  createGame,
  act,
  placements,
  royalSlots,
  armourSlots,
} from "../engine.mjs";

test("24 seeded revised games conserve all 54 cards and reach terminal states", () => {
  for (let seed = 1; seed <= 24; seed++) {
    let rng = seed;
    const random = () => {
      rng = (rng * 1664525 + 1013904223) >>> 0;
      return rng / 4294967296;
    };
    let s = createGame("revised", shuffle(deck(), random));
    for (let turn = 0; turn < 600 && s.status === "playing"; turn++) {
      const cards = [
        ...s.deck,
        ...s.grid.flat(),
        ...s.ploys,
        ...s.spent,
        ...s.shame,
        ...s.queue,
        ...(s.pending ? [s.pending] : []),
        ...s.royals.flatMap((r) => (r ? [r.card, ...r.armourCards] : [])),
      ];
      assert.equal(cards.length, 54);
      assert.equal(new Set(cards.map((c) => c.id)).size, 54);
      let action;
      if (s.stage === "mulligan") action = { type: "keep" };
      else if (s.pending?.rank >= 11)
        action = { type: "royal", index: royalSlots(s)[0] };
      else if (placements(s).length)
        action = { type: "place", index: placements(s)[0] };
      else if (!s.pending && s.deck.length) action = { type: "draw" };
      else if (s.ploys.some((c) => c.rank === 1))
        action = { type: "extract", index: s.grid.findIndex((x) => x.length) };
      else if (s.ploys.some((c) => c.rank === 0)) {
        const from = s.grid.findIndex(
          (stack, i) =>
            stack.length && placements(s, stack.at(-1)).some((j) => j !== i),
        );
        assert.notEqual(from, -1);
        action = {
          type: "move",
          from,
          index: placements(s, s.grid[from].at(-1)).find((j) => j !== from),
        };
      } else action = { type: "armour", index: armourSlots(s)[0] };
      s = act(s, action);
    }
    assert.notEqual(s.status, "playing", `seed ${seed} stalled`);
  }
});
