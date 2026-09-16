import {
  createGame,
  act,
  top,
  label,
  royal,
  placements,
  royalSlots,
  armourSlots,
  kills,
  damage,
  lanes,
  slotNames,
  color,
  symbols,
} from "./engine.mjs";
const $ = (id) => document.getElementById(id);
let state = createGame();
let selection = null;
let source = null;
let requestedMode = state.mode;
const rank = (c) =>
  ({ 0: "✦", 1: "A", 11: "J", 12: "Q", 13: "K" })[c.rank] ?? c.rank;
function cardHTML(c) {
  return `<span class="corner">${rank(c)}<span>${symbols[c.suit]}</span></span><span class="suit">${symbols[c.suit]}</span><span class="corner reverse">${rank(c)}<span>${symbols[c.suit]}</span></span>`;
}
function dispatch(action) {
  try {
    state = act(state, action);
    selection = null;
    source = null;
    render();
  } catch (error) {
    $("status").textContent = error.message;
  }
}
function gridAction(index) {
  if (state.status !== "playing") return;
  if (selection === "move") {
    if (source === null) {
      if (state.grid[index].length) {
        source = index;
        render();
      }
      return;
    }
    dispatch({ type: "move", from: source, index });
  } else if (selection) dispatch({ type: selection, index });
  else if (state.stage === "mulligan") dispatch({ type: "replace", index });
  else dispatch({ type: "place", index });
}
function gridLegal(i) {
  if (state.status !== "playing") return false;
  if (selection === "move")
    return source === null
      ? !!state.grid[i].length
      : i !== source && placements(state, top(state.grid[source])).includes(i);
  if (selection) return !!state.grid[i].length;
  return (
    state.stage === "mulligan" ||
    (state.stage === "play" && placements(state).includes(i))
  );
}
function hint() {
  if (state.status !== "playing") return "Start a new siege when you’re ready.";
  if (selection === "move")
    return source === null
      ? "Select the top card to reassign."
      : "Select a highlighted destination.";
  if (selection === "extract")
    return "Select a stack to recycle. The pending card stays in your hand.";
  if (selection === "reset")
    return "Select a stack to recycle. The blocked card goes to shame.";
  if (selection === "refill")
    return "Select a stack. Its top card goes to shame.";
  if (state.stage === "mulligan")
    return "Select a grid card to replace it, or keep the deal.";
  if (royal(state.pending))
    return "Select a highlighted border slot. Ties are your choice.";
  if (state.pending && !placements(state).length)
    return state.ploys.length
      ? "Blocked. Use a ploy to make room."
      : state.mode === "classic"
        ? "Blocked. Add armour at the border, or choose Hard reset."
        : "Blocked. Select a highlighted royal to add armour.";
  if (!state.pending && !state.deck.length)
    return state.mode === "classic"
      ? "Deck empty. Recycle a stack to continue."
      : "Deck empty. Your remaining ploys can still save the siege.";
  return state.pending
    ? "Select a highlighted grid slot to play."
    : "Draw a card, or use a ploy before drawing.";
}
function render() {
  const focused = document.activeElement?.id;
  $("board").replaceChildren();
  const coords = [
    [1, 2],
    [1, 3],
    [1, 4],
    [2, 5],
    [3, 5],
    [4, 5],
    [5, 4],
    [5, 3],
    [5, 2],
    [4, 1],
    [3, 1],
    [2, 1],
  ];
  const royalLegal =
    state.status === "playing"
      ? royal(state.pending)
        ? royalSlots(state)
        : armourSlots(state)
      : [];
  coords.forEach(([row, col], i) => {
    const r = state.royals[i];
    const button = document.createElement("button");
    button.id = `royal-${i}`;
    button.className = `card royal ${r ? color(r.card) : "vacant"} ${r?.dead ? "dead" : ""} ${royalLegal.includes(i) ? "legal" : ""}`;
    button.style.gridArea = `${row} / ${col}`;
    button.innerHTML = r
      ? r.dead
        ? '<span class="seal">✕</span><span class="card-note">DEFEATED</span>'
        : `${cardHTML(r.card)}<span class="health">${damage(state, i)} / ${r.card.rank + r.armour}${r.armour ? " ◈" : ""}</span>`
      : `<span class="vacant-mark">${["↓", "←", "↑", "→"][Math.floor(i / 3)]}</span><span class="card-note">${slotNames[i]}</span>`;
    button.setAttribute(
      "aria-label",
      `${slotNames[i]}: ${r ? `${label(r.card)}, ${r.dead ? "defeated" : `${r.card.rank + r.armour} health, payload ${damage(state, i)}`}` : "empty royal slot"}${royalLegal.includes(i) ? ", legal target" : ""}`,
    );
    button.setAttribute("aria-disabled", !royalLegal.includes(i));
    button.addEventListener("click", () => {
      if (royalLegal.includes(i))
        dispatch({ type: royal(state.pending) ? "royal" : "armour", index: i });
    });
    $("board").append(button);
  });
  state.grid.forEach((stack, i) => {
    const c = top(stack);
    const button = document.createElement("button");
    button.id = `grid-${i}`;
    button.className = `card grid-card ${c ? color(c) : "vacant"} ${gridLegal(i) ? "legal" : ""} ${source === i ? "selected" : ""}`;
    button.style.gridArea = `${Math.floor(i / 3) + 2} / ${(i % 3) + 2}`;
    button.innerHTML = `${c ? cardHTML(c) : '<span class="vacant-mark">+</span>'}<span class="stack-count">${stack.length > 1 ? `${stack.length} deep` : ""}</span><span class="key-number">${i + 1}</span>`;
    button.setAttribute(
      "aria-label",
      `Grid ${i + 1}: ${label(c)}, stack ${stack.length}${gridLegal(i) ? ", legal target" : ""}`,
    );
    button.setAttribute("aria-disabled", !gridLegal(i));
    const preview = lanes
      .flatMap((lane, slot) =>
        lane[2] === i && state.royals[slot] && !state.royals[slot].dead
          ? [
              `${slotNames[slot]}: ${damage(state, slot)}/${state.royals[slot].card.rank + state.royals[slot].armour}`,
            ]
          : [],
      )
      .join(" · ");
    button.title = preview || "No living royal in this firing line";
    button.addEventListener("click", () => {
      if (gridLegal(i)) gridAction(i);
    });
    $("board").append(button);
  });
  $("mode-badge").textContent =
    state.mode === "revised" ? "REVISED / V2" : "CLASSIC / V1";
  $("phase").textContent =
    state.status === "won"
      ? "SIEGE COMPLETE"
      : state.status === "lost"
        ? "SIEGE ENDED"
        : state.stage === "play"
          ? "FIRING GRID"
          : "OPENING DEAL";
  $("kills").innerHTML = `${kills(state)}<span>/12</span>`;
  $("deck-count").textContent = state.deck.length;
  $("turn").textContent = `TURN ${String(state.turns).padStart(2, "0")}`;
  $("pending").innerHTML = state.pending
    ? `<div class="card hand ${color(state.pending)}">${cardHTML(state.pending)}</div><div><span class="eyebrow">IN YOUR HAND</span><strong>${label(state.pending)}</strong><small>${royal(state.pending) ? "Deploy a royal" : "Place to fire"}</small></div>`
    : '<div class="card card-back"><span>▦</span></div><div><span class="eyebrow">NEXT MOVE</span><strong>Make it count.</strong><small>The deck is waiting.</small></div>';
  $("status").textContent = state.message;
  $("hint").textContent = hint();
  $("draw").disabled =
    state.status !== "playing" ||
    state.stage !== "play" ||
    !!state.pending ||
    !state.deck.length ||
    !!selection;
  $("draw").hidden = state.stage !== "play";
  $("keep").hidden = state.stage !== "mulligan";
  $("terminal").hidden = state.status === "playing";
  $("terminal").textContent =
    state.status === "won"
      ? "VICTORY / twelve down"
      : "DEFEAT / try another line";
  $("tools").replaceChildren();
  const available = state.status === "playing" && state.stage === "play";
  function tool(text, type, enabled) {
    const b = document.createElement("button");
    b.textContent = text;
    b.disabled = !available || !enabled;
    b.className = selection === type ? "active" : "";
    b.addEventListener("click", () => {
      selection = type;
      source = null;
      render();
    });
    $("tools").append(b);
  }
  if (state.mode === "revised") {
    const aces = state.ploys.filter((c) => c.rank === 1).length;
    const jokers = state.ploys.filter((c) => c.rank === 0).length;
    $("tools-title").textContent = "YOUR PLOYS";
    tool(
      `A · Extract  ×${aces}`,
      "extract",
      aces && state.grid.some((x) => x.length),
    );
    tool(
      `✦ · Reassign  ×${jokers}`,
      "move",
      jokers && state.grid.some((x) => x.length),
    );
    $("tool-help").textContent =
      "Ace: recycle a stack. Joker: move a top card. Each can be used once.";
  } else {
    $("tools-title").textContent = `RESET TOOLS / SHAME ${state.shame.length}`;
    tool(
      "Hard reset",
      "reset",
      state.pending && !royal(state.pending) && !placements(state).length,
    );
    tool("Recycle empty deck", "refill", !state.pending && !state.deck.length);
    $("tool-help").textContent =
      "Aces and jokers reset stacks when played. Hard resets cost one shame.";
  }
  $("cancel").hidden = !selection;
  if (focused) document.getElementById(focused)?.focus({ preventScroll: true });
}
$("draw").onclick = () => dispatch({ type: "draw" });
$("keep").onclick = () => dispatch({ type: "keep" });
$("cancel").onclick = () => {
  selection = null;
  source = null;
  render();
};
$("rules-open").onclick = () => $("rules").showModal();
$("rules-close").onclick = () => $("rules").close();
function requestNew(mode) {
  requestedMode = mode;
  $("confirm").showModal();
}
$("new").onclick = () => requestNew(state.mode);
$("mode").onchange = () => {
  requestNew($("mode").value);
  $("mode").value = state.mode;
};
$("confirm-no").onclick = () => $("confirm").close();
$("confirm-yes").onclick = () => {
  state = createGame(requestedMode);
  $("mode").value = requestedMode;
  selection = null;
  source = null;
  $("confirm").close();
  render();
};
document.addEventListener("keydown", (e) => {
  if (
    document.querySelector("dialog[open]") ||
    ["SELECT", "INPUT", "TEXTAREA"].includes(e.target.tagName) ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey
  )
    return;
  if (/^[1-9]$/.test(e.key)) {
    e.preventDefault();
    const i = Number(e.key) - 1;
    if (gridLegal(i)) gridAction(i);
  } else if (
    e.key === " " &&
    !["BUTTON", "A", "SUMMARY"].includes(e.target.tagName)
  ) {
    e.preventDefault();
    if (!$("draw").disabled) $("draw").click();
  } else if (
    e.key === "Enter" &&
    state.stage === "mulligan" &&
    e.target === document.body
  )
    $("keep").click();
  else if (e.key.toLowerCase() === "n") requestNew(state.mode);
  else if (e.key === "?") $("rules").showModal();
  else if (e.key === "Escape") $("cancel").click();
});
render();
