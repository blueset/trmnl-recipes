function packKey(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function packDisplayName(name) {
  const shortNames = {
    "CAH Base Set": "Base Set",
    "CAH: Family Edition (Free Print & Play Public Beta)": "Family Edition (Beta)",
    "CAH: Hidden Gems Bundle: A Few New Cards We Crammed Into This Bundle Pack (Amazon Exclusive)": "Hidden Gems Bonus Pack",
    "Cards Against Humanity Saves America Pack": "Saves America Pack",
    "ClickHole Greeting Cards Pack (Target Exclusive)": "ClickHole Greeting Cards",
    "Gen Con 2018 Midterm Election Pack": "Gen Con 2018 Midterms Pack",
    "Jew Pack/Chosen People Pack": "Chosen People (Jew) Pack",
    "Nerd Bundle: A Few More Cards For You Nerds (Target Exclusive)": "Nerd Bundle Bonus Pack",
    "PAX East 2014 - Panel Cards": "PAX East 2014 Panel Cards",
    "PAX Prime 2014 - Panel Cards": "PAX Prime 2014 Panel Cards",
    "PAX Prime 2014 Custom Printed Cards": "PAX Prime 2014 Custom Cards",
    "PAX Prime 2015 Food Pack A (Mango)": "PAX Prime 2015 Food A (Mango)",
    "PAX Prime 2015 Food Pack B (Coconut)": "PAX Prime 2015 Food B (Coconut)",
    "PAX Prime 2015 Food Pack C (Cherry)": "PAX Prime 2015 Food C (Cherry)",
    "Theatre Pack - CATS Musical Pack": "Theatre: CATS Pack",
    "Trump Bug Out Bag/Post-Trump Pack": "Trump Bug-Out / Post-Trump Pack",
  };
  return Object.hasOwn(shortNames, name) ? shortNames[name] : name.replace(/^CAH:\s*/, "");
}

function displayCard(card) {
  return { ...card, pack: packDisplayName(card.pack) };
}

function draw(cards, count, color) {
  if (cards.length < count) {
    throw new Error(`Selected packs contain ${cards.length} ${color} cards; need ${count}.`);
  }

  const remaining = [...cards];
  const selected = [];
  for (let index = 0; index < count; index += 1) {
    const position = Math.floor(Math.random() * remaining.length);
    selected.push(remaining.splice(position, 1)[0]);
  }
  return selected;
}

function run(input) {
  // render demo image only:
  /*
  return { black: [
  {
    "pack": "CAH: Family Edition",
    "pick": 1,
    "text": "You don't love me, Sam. All you care about is _."
  }
], white: [
  {
    "pack": "CAH: Family Edition",
    "text": "Pork."
  }
] };
*/
 
  const settings = input?.trmnl?.plugin_settings?.custom_fields_values ?? {};
  const color = settings.color === undefined ? "both" : settings.color;
  const packValues = settings.packs === undefined ? ["all"] : settings.packs;
  const packs = Array.isArray(packValues) ? packValues : [packValues];
  if (!["both", "black", "white"].includes(color)) {
    throw new Error("Cards to show must be both, black, or white.");
  }
  if (packs.length === 0 || packs.some((pack) => typeof pack !== "string" || !pack)) {
    throw new Error("Choose at least one pack.");
  }

  const data = input?.IDX_0 ?? input?.data ?? input;
  if (!Array.isArray(data?.black) || !Array.isArray(data?.white)) {
    throw new Error("REST Against Humanity must return black and white card arrays.");
  }
  for (const cardColor of ["black", "white"]) {
    for (const card of data[cardColor]) {
      if (!card || typeof card.text !== "string" || typeof card.pack !== "string" ||
          (cardColor === "black" && (!Number.isInteger(card.pick) || card.pick < 1))) {
        throw new Error(`REST Against Humanity returned an invalid ${cardColor} card.`);
      }
    }
  }

  const allPacks = packs.includes("all");
  const selectedPacks = new Set(packs);
  if (!allPacks) {
    const availablePacks = new Set([...data.black, ...data.white].map((card) => packKey(card.pack)));
    for (const pack of selectedPacks) {
      if (!availablePacks.has(pack)) {
        throw new Error(`Selected pack is unavailable: ${pack}.`);
      }
    }
  }
  const fromSelectedPacks = (card) => allPacks || selectedPacks.has(packKey(card.pack));
  const black = data.black.filter(fromSelectedPacks);
  const white = data.white.filter(fromSelectedPacks);

  if (color === "black") return { black: draw(black, 1, "black").map(displayCard), white: [] };
  if (color === "white") return { black: [], white: draw(white, 1, "white").map(displayCard) };

  const selectedBlack = draw(black, 1, "black");
  return {
    black: selectedBlack.map(displayCard),
    white: draw(white, selectedBlack[0].pick, "white").map(displayCard),
  };
}
