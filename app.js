const HANDOFF_DIR = "./guess_the_player_game_handoff_20260611_092741";
const DATA_URLS = [
  "./data/guess-the-player.min.json",
  `${HANDOFF_DIR}/guess_the_player_game_data.json`
];
const MAX_ATTEMPTS = 6;
const STORAGE_KEY = "guess-the-player-stats-v1";
const DANGLING_TRAIL_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "being",
  "but",
  "by",
  "can",
  "could",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "his",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "may",
  "might",
  "must",
  "of",
  "on",
  "onto",
  "or",
  "should",
  "than",
  "that",
  "the",
  "their",
  "these",
  "this",
  "those",
  "to",
  "was",
  "were",
  "which",
  "while",
  "who",
  "will",
  "with",
  "without",
  "would"
]);
const DANGLING_TRAIL_STEMS = new Set([
  "affectiv",
  "becaus",
  "calib",
  "coul",
  "despi",
  "div",
  "e",
  "hav",
  "highe",
  "offensiv",
  "p",
  "shoul",
  "wil",
  "woul"
]);

const QUALITY_LABELS = {
  positive: "Positive",
  negative: "Risk",
  true_negative: "Risk",
  mixed: "Mixed",
  not_discussed: "Context",
  translation_caveat: "Caveat"
};

const els = {
  roundStatus: document.querySelector("#roundStatus"),
  clueList: document.querySelector("#clueList"),
  traitChips: document.querySelector("#traitChips"),
  guessForm: document.querySelector("#guessForm"),
  guessInput: document.querySelector("#guessInput"),
  guessButton: document.querySelector("#guessButton"),
  randomGuessButton: document.querySelector("#randomGuessButton"),
  suggestionList: document.querySelector("#suggestionList"),
  message: document.querySelector("#message"),
  guessTableBody: document.querySelector("#guessTableBody"),
  guessCountLabel: document.querySelector("#guessCountLabel"),
  attemptPips: document.querySelector("#attemptPips"),
  newGameButton: document.querySelector("#newGameButton"),
  portraitFrame: document.querySelector("#portraitFrame"),
  playerHeadshot: document.querySelector("#playerHeadshot"),
  portraitFallback: document.querySelector("#portraitFallback"),
  answerSummary: document.querySelector("#answerSummary"),
  answerName: document.querySelector("#answerName"),
  answerMeta: document.querySelector("#answerMeta"),
  hintsPanel: document.querySelector("#hintsPanel"),
  feedbackPanel: document.querySelector("#feedbackPanel"),
  hintList: document.querySelector("#hintList"),
  hintProgress: document.querySelector("#hintProgress"),
  statPlayed: document.querySelector("#statPlayed"),
  statWinRate: document.querySelector("#statWinRate"),
  statStreak: document.querySelector("#statStreak")
};

const state = {
  raw: null,
  players: [],
  playablePlayers: [],
  playerByKey: new Map(),
  playerBySearchKey: new Map(),
  cardsByPlayer: new Map(),
  answer: null,
  answerCards: [],
  revealedCards: [],
  guesses: [],
  selectedPlayer: null,
  activeSuggestionIndex: -1,
  activeSuggestions: [],
  gameOver: false,
  recorded: false,
  typewriterCardId: "",
  typewriterText: "",
  typewriterTimer: null,
  stats: loadStats()
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  renderAttemptPips();
  renderStats();
  bindEvents();
  installSmokeHooks();
  loadGameData();
}

function bindEvents() {
  els.guessForm.addEventListener("submit", handleGuessSubmit);
  els.guessInput.addEventListener("input", handleInput);
  els.guessInput.addEventListener("keydown", handleInputKeydown);
  els.guessInput.addEventListener("blur", () => {
    window.setTimeout(closeSuggestions, 120);
  });
  els.newGameButton.addEventListener("click", () => startNewGame());
  els.randomGuessButton.addEventListener("click", handleRandomGuess);
  els.playerHeadshot.addEventListener("error", handleHeadshotError);
}

async function loadGameData() {
  setMessage("Loading 817 players and 13,270 scouting clues...");

  try {
    const data = await fetchFirstAvailableData();
    state.raw = data;
    prepareData(data);
    startNewGame();
  } catch (error) {
    els.roundStatus.textContent = "Data could not be loaded.";
    setMessage("Start a local server from this folder, then reload. Example: python -m http.server 5173", "error");
    console.error(error);
  }
}

async function fetchFirstAvailableData() {
  const errors = [];

  for (const url of DATA_URLS) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }

  throw new Error(errors.join("; "));
}

function prepareData(data) {
  const cardsByPlayer = new Map();

  for (const card of data.phrase_cards || []) {
    const text = card.phrase_text_redacted || card.phrase_text || "";
    if (!text.trim()) continue;
    if (!cardsByPlayer.has(card.player_key)) {
      cardsByPlayer.set(card.player_key, []);
    }
    cardsByPlayer.get(card.player_key).push(card);
  }

  state.cardsByPlayer = cardsByPlayer;
  state.players = (data.players || [])
    .map((player) => normalizePlayer(player))
    .sort((a, b) => a.player_name.localeCompare(b.player_name));

  state.playerByKey = new Map(state.players.map((player) => [player.player_key, player]));
  state.playerBySearchKey = new Map(state.players.map((player) => [player.searchKey, player]));
  state.playablePlayers = state.players.filter((player) => {
    const cards = cardsByPlayer.get(player.player_key) || [];
    return cards.length > 0 && player.headshot_package_relative_file;
  });
}

function normalizePlayer(player) {
  const draftYear = toNumber(player.draft_year);
  const actualPick = toNumber(player.actual_pick);
  const firstInitial = player.player_initial || firstLetter(player.player_name);
  const surnameInitial = player.surname_initial || surnameLetter(player.player_name);
  const searchKey = normalizeSearch(player.player_name);
  const nameParts = searchKey.split(" ").filter(Boolean);
  const fullInitialsKey = nameParts.map((part) => part[0]).join("");
  const initialsKey = `${firstInitial}${surnameInitial}`.toLowerCase();

  return {
    ...player,
    draft_year: draftYear,
    actual_pick: actualPick,
    player_initial: firstInitial,
    surname_initial: surnameInitial,
    searchKey,
    fullInitialsKey,
    initialsKey
  };
}

function startNewGame() {
  if (!state.playablePlayers.length) return;

  const answer = state.playablePlayers[randomInt(state.playablePlayers.length)];
  startRound(answer);
}

function startRound(answer) {
  const cards = prepareCardsForPlayer(answer);
  state.answer = answer;
  state.answerCards = cards;
  state.revealedCards = cards.length ? [cards[0]] : [];
  state.guesses = [];
  state.selectedPlayer = null;
  state.activeSuggestionIndex = -1;
  state.activeSuggestions = [];
  state.gameOver = false;
  state.recorded = false;
  resetTypewriter();

  els.guessInput.disabled = false;
  els.guessButton.disabled = false;
  els.randomGuessButton.disabled = false;
  els.guessInput.value = "";
  els.guessInput.focus();

  renderAll();
  setMessage(`Player database ready: ${state.players.length} names available.`);
}

function prepareCardsForPlayer(player) {
  const rawCards = state.cardsByPlayer.get(player.player_key) || [];
  const deduped = [];
  const seen = new Set();

  for (const card of rawCards) {
    const phrases = cleanPhrases(card, player);
    phrases.forEach((clean, phraseIndex) => {
      const key = clean.toLowerCase();
      if (clean.length < 24 || seen.has(key)) return;
      seen.add(key);
      deduped.push({
        ...card,
        card_id: `${card.card_id}_${phraseIndex}`,
        clean_phrase: clean,
        interestScore: scoreCard(card, clean)
      });
    });
  }

  const shuffled = shuffle(deduped);
  return shuffled.sort((a, b) => b.interestScore - a.interestScore);
}

function scoreCard(card, text) {
  let score = 0;
  const quality = card.trait_quality || "";
  const confidence = toNumber(card.max_llm_confidence) || 0;
  const phraseCount = toNumber(card.phrase_count) || 0;

  if (quality === "positive" || quality === "negative") score += 8;
  if (quality === "mixed") score += 6;
  if (quality === "not_discussed") score -= 4;
  if (text.length >= 90 && text.length <= 520) score += 4;
  if (text.length > 720) score -= 3;
  score += confidence * 4;
  score += Math.min(phraseCount, 4);

  return score;
}

function cleanPhrases(card, player) {
  const raw = card.phrase_text_redacted || card.phrase_text || "";
  const decoded = normalizeEncoding(raw)
    .replace(/\s+/g, " ")
    .replace(/\s+\./g, ".")
    .trim();

  const redacted = replacePlayerPlaceholders(redactPlayerName(decoded, player.player_name));
  return splitClueText(redacted)
    .map(stripSourceLeakage)
    .filter((phrase) => !hasMismatchedNamedSubject(phrase, player))
    .map(addTrailOff)
    .map((phrase) => phrase.replace(/\s+/g, " ").trim())
    .filter((phrase) => phrase.length >= 24);
}

function hasMismatchedNamedSubject(phrase, player) {
  const answerParts = new Set(normalizeSearch(player.player_name).split(" ").filter(Boolean));
  const subjectPattern = /\b([A-Z][A-Za-z.'-]{2,}(?:\s+[A-Z][A-Za-z.'-]{2,}){0,2})\s+(?:is|was|has|had|averaged|shot|shoots|will|would|can|could|should|projects|appears|looks)\b/g;

  for (const match of String(phrase).matchAll(subjectPattern)) {
    const subject = normalizeSearch(match[1]).split(" ").filter(Boolean);
    if (!subject.length) continue;
    if (subject.every((part) => answerParts.has(part))) continue;

    return true;
  }

  return false;
}

function splitClueText(text) {
  const reportParts = String(text)
    .split(/\s*\|\|\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  const phrases = [];
  for (const part of reportParts) {
    const ellipsisPhrases = splitOnEllipses(part);
    if (ellipsisPhrases.length > 1) {
      phrases.push(...ellipsisPhrases);
      continue;
    }

    const cleanPart = ellipsisPhrases[0] || part;
    if (cleanPart.length <= 260) {
      phrases.push(cleanPart);
      continue;
    }

    const sentences = cleanPart.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanPart];
    let current = "";
    for (const sentence of sentences) {
      const cleanSentence = sentence.trim();
      if (!cleanSentence) continue;
      const next = current ? `${current} ${cleanSentence}` : cleanSentence;
      if (next.length > 260 && current) {
        phrases.push(current);
        current = cleanSentence;
      } else {
        current = next;
      }
    }
    if (current) phrases.push(current);
  }

  return phrases;
}

function splitOnEllipses(text) {
  const pieces = String(text)
    .split(/\s*(?:\u2026|\.{3,})\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (pieces.length <= 1) return pieces;

  const groups = [];
  let current = [];
  for (const piece of pieces) {
    current.push(piece);
    const joined = current.join("... ");
    if (current.length >= 2 || joined.length >= 220) {
      groups.push(joined);
      current = [];
    }
  }

  if (current.length) {
    const tail = current.join("... ");
    const previous = groups.at(-1);
    if (previous && tail.length < 56 && `${previous}... ${tail}`.length <= 260) {
      groups[groups.length - 1] = `${previous}... ${tail}`;
    } else {
      groups.push(tail);
    }
  }

  return groups;
}

function stripSourceLeakage(phrase) {
  return phrase
    .replace(/^(?:doug|chad|jonathan|mike|kevin|sam|derek|jake|jeremy|ar an|aran|scout|analyst)\s+(?:says|writes|notes|said)\s*:\s*/i, "")
    .replace(/^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3}\s+(?:says|writes|notes|said)\s*:\s*/g, "")
    .replace(/^(?:espn|nbadraft\.net|nba draft net|draft express|draftexpress|the ringer|yahoo|sports illustrated|si|cbs|247sports)[^:]{0,50}:\s*/i, "")
    .replace(/\b(?:by|from)\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3}\b,?/g, "")
    .replace(/\b(?:updated|published|posted|last updated)\s*:?\s*/gi, "")
    .replace(/\b(?:jan\.?|january|feb\.?|february|mar\.?|march|apr\.?|april|may|jun\.?|june|jul\.?|july|aug\.?|august|sep\.?|sept\.?|september|oct\.?|october|nov\.?|november|dec\.?|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*)?(?:19|20)\d{2}\b/gi, "")
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-](?:19|20)?\d{2}\b/g, "")
    .replace(/\b(?:19|20)\d{2}\b/g, "")
    .replace(/\bborn\s+in\s*,\s*/gi, "")
    .replace(/\b(?:in|on|at|from)\s*,\s*/gi, "")
    .replace(/\s*[-:]\s*$/, "")
    .trim();
}

function addTrailOff(phrase) {
  const clean = trimDanglingTrail(phrase);
  if (!clean) return clean;
  if (/[.!?]["')\]]?$/.test(clean)) return clean;
  return `${clean}...`;
}

function replacePlayerPlaceholders(text) {
  return String(text)
    .replace(/\[PLAYER\]\s*['’]s\b/g, "His")
    .replace(/\[PLAYER\]\s+(is|was|has|had|does|did|can|could|will|would|should|must)\b/gi, (_, verb) => {
      return `He ${verb.toLowerCase()}`;
    })
    .replace(/\[PLAYER\]/g, "the player");
}

function trimDanglingTrail(phrase) {
  let clean = String(phrase)
    .replace(/\s+/g, " ")
    .replace(/\s*(?:\u2026|\.{3,})\s*$/g, "")
    .replace(/\s+[,;:]$/g, "")
    .trim();

  for (let index = 0; index < 4; index += 1) {
    const next = trimOneDanglingTail(clean);
    if (next === clean) return clean;
    clean = next;
  }

  return clean;
}

function trimOneDanglingTail(phrase) {
  let clean = phrase.trim();

  const orphanTail = clean.replace(/\s+(?:[A-Za-z]|\d+(?:\.\d+)?)$/g, "").trim();
  if (orphanTail.length >= 24 && orphanTail !== clean) {
    return orphanTail.replace(/\s+[,;:]$/g, "").trim();
  }

  const tailMatch = clean.match(/\b([A-Za-z']+)$/);
  if (!tailMatch) return clean;

  const word = tailMatch[1].replace(/^'+|'+$/g, "").toLowerCase();
  const beforeTail = clean.slice(0, tailMatch.index).replace(/\s+[,;:]$/g, "").trim();
  if (beforeTail.length >= 24 && DANGLING_TRAIL_STEMS.has(word)) {
    return beforeTail;
  }
  if (beforeTail.length >= 24 && DANGLING_TRAIL_WORDS.has(word)) {
    return beforeTail;
  }

  return clean;
}

function normalizeEncoding(text) {
  return String(text)
    .replace(/\u2026/g, "...")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, "\"")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u00e2\u20ac\u00a6/g, "...")
    .replace(/\u00e2\u20ac\u2122/g, "'")
    .replace(/\u00e2\u20ac\u0153/g, "\"")
    .replace(/\u00e2\u20ac\u009d/g, "\"")
    .replace(/\u00e2\u20ac\u201c/g, "-")
    .replace(/\u00c2|\u00a0/g, " ");
}

function redactPlayerName(text, playerName) {
  if (!playerName) return text;

  let redacted = text;
  const parts = playerName.split(/\s+/).filter(Boolean);
  const tokens = [playerName];
  const first = parts[0];
  const last = parts[parts.length - 1];

  if (first && first.length > 3) tokens.push(first);
  if (last && last.length > 2) tokens.push(last);

  for (const token of tokens) {
    const pattern = new RegExp(`\\b${escapeRegExp(token)}\\b`, "gi");
    redacted = redacted.replace(pattern, "[PLAYER]");
  }

  return redacted;
}

function handleGuessSubmit(event) {
  event.preventDefault();
  if (state.gameOver || !state.answer) return;

  const player = state.selectedPlayer || findPlayerFromInput(els.guessInput.value);
  if (!player) {
    setMessage("Choose a player from the search results.", "error");
    return;
  }

  if (state.guesses.some((guess) => guess.player.player_key === player.player_key)) {
    setMessage("You already guessed that player.", "error");
    return;
  }

  const evaluation = evaluateGuess(player);
  state.guesses.push({ player, evaluation });
  state.selectedPlayer = null;
  els.guessInput.value = "";
  closeSuggestions();

  if (player.player_key === state.answer.player_key) {
    state.gameOver = true;
    recordGame(true);
    setMessage(`Correct in ${state.guesses.length}.`, "success");
  } else if (state.guesses.length >= MAX_ATTEMPTS) {
    revealAllAnswerContext();
    state.gameOver = true;
    recordGame(false);
    setMessage(`Out of guesses. The answer was ${state.answer.player_name}.`, "error");
  } else {
    revealNextClue();
    setMessage(buildMissMessage(evaluation));
  }

  renderAll();
}

function findPlayerFromInput(value) {
  const key = normalizeSearch(value);
  if (!key) return null;
  return state.playerBySearchKey.get(key) || null;
}

function handleInput() {
  state.selectedPlayer = null;
  renderSuggestions(els.guessInput.value);
}

function handleInputKeydown(event) {
  const suggestions = state.activeSuggestions;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (!suggestions.length) {
      renderSuggestions(els.guessInput.value);
      return;
    }
    state.activeSuggestionIndex = (state.activeSuggestionIndex + 1) % suggestions.length;
    renderSuggestions(els.guessInput.value, true);
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (!suggestions.length) return;
    state.activeSuggestionIndex =
      (state.activeSuggestionIndex - 1 + suggestions.length) % suggestions.length;
    renderSuggestions(els.guessInput.value, true);
  }

  if (event.key === "Enter" && state.activeSuggestionIndex >= 0) {
    const player = suggestions[state.activeSuggestionIndex];
    if (player) {
      event.preventDefault();
      selectSuggestion(player);
    }
  }

  if (event.key === "Escape") {
    closeSuggestions();
  }
}

function renderSuggestions(query, keepIndex = false) {
  const normalized = normalizeSearch(query);
  if (!normalized || state.gameOver) {
    closeSuggestions();
    return;
  }

  const guessedKeys = new Set(state.guesses.map((guess) => guess.player.player_key));
  const matches = state.players
    .filter((player) => !guessedKeys.has(player.player_key))
    .map((player) => ({
      player,
      score: scoreSearchMatch(player, normalized)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.player.player_name.localeCompare(b.player.player_name))
    .slice(0, 10)
    .map((item) => item.player);

  state.activeSuggestions = matches;
  if (!keepIndex) state.activeSuggestionIndex = -1;
  if (state.activeSuggestionIndex >= matches.length) state.activeSuggestionIndex = matches.length - 1;

  els.suggestionList.innerHTML = "";

  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "suggestion";
    empty.textContent = "No matching players";
    els.suggestionList.appendChild(empty);
  } else {
    matches.forEach((player, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `suggestion${index === state.activeSuggestionIndex ? " active" : ""}`;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", index === state.activeSuggestionIndex ? "true" : "false");
      button.innerHTML = `
        <span>${escapeHtml(player.player_name)}</span>
        <small>${formatDraftMeta(player)}</small>
      `;
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => selectSuggestion(player));
      els.suggestionList.appendChild(button);
    });
  }

  els.suggestionList.classList.add("open");
  els.guessInput.setAttribute("aria-expanded", "true");
}

function scoreSearchMatch(player, query) {
  const name = player.searchKey;
  const compactQuery = query.replace(/\s+/g, "");
  const queryParts = query.split(" ").filter(Boolean);
  const nameParts = name.split(" ").filter(Boolean);
  const boardFit = scoreBoardFit(player);

  if (compactQuery.length >= 2) {
    if (player.initialsKey === compactQuery) return 940 + boardFit;
    if (player.fullInitialsKey === compactQuery) return 930 + boardFit;
    if (player.fullInitialsKey.startsWith(compactQuery)) return 720 - name.length + boardFit;
  }

  if (name === query) return 1000 + boardFit;
  if (name.startsWith(query)) return 850 - name.length + boardFit;
  if (queryParts.length > 1 && queryParts.every((part, index) => nameParts[index]?.startsWith(part))) {
    return 820 - name.length + boardFit;
  }
  if (name.split(" ").some((part) => part.startsWith(query))) return 700 - name.length + boardFit;
  if (name.includes(query)) return 500 - name.indexOf(query) + boardFit;
  return 0;
}

function scoreBoardFit(player) {
  if (!state.guesses.length) return 0;

  let score = 0;
  for (const guess of state.guesses) {
    const guessed = guess.player;
    const evaluation = guess.evaluation;

    if (evaluation.firstInitial.status === "hit" && player.player_initial === evaluation.firstInitial.label) score += 70;
    if (evaluation.surnameInitial.status === "hit" && player.surname_initial === evaluation.surnameInitial.label) score += 70;
    if (evaluation.round.status === "hit" && player.round_display === evaluation.round.label) score += 40;

    score += scoreComparisonFit(player.draft_year, guessed.draft_year, evaluation.draftYear, 90);
    score += scoreComparisonFit(player.actual_pick, guessed.actual_pick, evaluation.pick, 70);
  }

  return score;
}

function scoreComparisonFit(candidateValue, guessedValue, evaluation, weight) {
  if (!Number.isFinite(candidateValue) || !Number.isFinite(guessedValue)) return 0;
  if (evaluation.status === "hit" && candidateValue === guessedValue) return weight;
  if (evaluation.label === "Earlier" && candidateValue < guessedValue) return Math.round(weight * 0.7);
  if (evaluation.label === "Later" && candidateValue > guessedValue) return Math.round(weight * 0.7);
  return 0;
}

function selectSuggestion(player) {
  state.selectedPlayer = player;
  els.guessInput.value = player.player_name;
  closeSuggestions();
  setMessage("");
}

function handleRandomGuess() {
  if (state.gameOver || !state.answer) return;

  const guessedKeys = new Set(state.guesses.map((guess) => guess.player.player_key));
  const candidates = state.players.filter((player) => !guessedKeys.has(player.player_key));
  if (!candidates.length) {
    setMessage("No players left to pick.", "error");
    return;
  }

  const player = candidates[randomInt(candidates.length)];
  state.selectedPlayer = player;
  els.guessInput.value = player.player_name;
  closeSuggestions();
  setMessage("Random player selected.");
  els.guessInput.focus();
}

function closeSuggestions() {
  state.activeSuggestionIndex = -1;
  state.activeSuggestions = [];
  els.suggestionList.classList.remove("open");
  els.suggestionList.innerHTML = "";
  els.guessInput.setAttribute("aria-expanded", "false");
}

function evaluateGuess(player) {
  const answer = state.answer;
  const draftYearResult = compareDraftYear(player.draft_year, answer.draft_year);
  const pickResult = comparePick(player, answer);

  return {
    firstInitial: compareText(player.player_initial, answer.player_initial, answer.player_initial),
    surnameInitial: compareText(player.surname_initial, answer.surname_initial, answer.surname_initial),
    draftYear: draftYearResult,
    pick: pickResult,
    round: compareText(player.round_display, answer.round_display, answer.round_display)
  };
}

function compareText(guessValue, answerValue, labelValue) {
  if (!guessValue || !answerValue) {
    return { status: "unknown", label: "Unknown" };
  }

  const status = String(guessValue).toLowerCase() === String(answerValue).toLowerCase() ? "hit" : "miss";
  return {
    status,
    label: status === "hit" ? labelValue : String(guessValue)
  };
}

function compareDraftYear(guessYear, answerYear) {
  if (!Number.isFinite(guessYear) || !Number.isFinite(answerYear)) {
    return { status: "unknown", label: "Unknown" };
  }

  const diff = guessYear - answerYear;
  if (diff === 0) return { status: "hit", label: String(answerYear) };
  if (Math.abs(diff) <= 1) {
    return {
      status: "near",
      label: diff < 0 ? "Later" : "Earlier"
    };
  }

  return {
    status: "miss",
    label: diff < 0 ? "Later" : "Earlier"
  };
}

function comparePick(guessPlayer, answerPlayer) {
  const guessPick = guessPlayer.actual_pick;
  const answerPick = answerPlayer.actual_pick;
  const guessUndrafted = isUndrafted(guessPlayer);
  const answerUndrafted = isUndrafted(answerPlayer);

  if (guessUndrafted || answerUndrafted) {
    return {
      status: guessUndrafted && answerUndrafted ? "hit" : "unknown",
      label: guessUndrafted ? "Undrafted" : "Drafted"
    };
  }

  if (!Number.isFinite(guessPick) || !Number.isFinite(answerPick)) {
    return { status: "unknown", label: guessUndrafted ? "Undrafted" : "Pick unknown" };
  }

  const diff = guessPick - answerPick;
  if (diff === 0) return { status: "hit", label: `#${Math.round(answerPick)}` };
  if (Math.abs(diff) <= 5) {
    return {
      status: "near",
      label: diff < 0 ? "Later" : "Earlier"
    };
  }

  return {
    status: "miss",
    label: diff < 0 ? "Later" : "Earlier"
  };
}

function buildMissMessage(evaluation) {
  const hits = [
    evaluation.firstInitial.status === "hit" ? "first initial" : null,
    evaluation.surnameInitial.status === "hit" ? "last initial" : null,
    evaluation.draftYear.status === "hit" ? "draft year" : null,
    evaluation.pick.status === "hit" ? "pick" : null,
    evaluation.round.status === "hit" ? "round" : null
  ].filter(Boolean);

  if (hits.length) {
    return `Not him, but you matched: ${hits.join(", ")}.`;
  }

  return "Not him. Another scouting clue unlocked.";
}

function revealNextClue() {
  const targetCount = Math.min(state.answerCards.length, state.guesses.length + 1);
  while (state.revealedCards.length < targetCount) {
    const nextCard = state.answerCards.find((card) => {
      return !state.revealedCards.some((revealed) => revealed.card_id === card.card_id);
    });
    if (!nextCard) break;
    state.revealedCards.push(nextCard);
  }
}

function revealAllAnswerContext() {
  while (state.revealedCards.length < Math.min(state.answerCards.length, MAX_ATTEMPTS)) {
    revealNextClue();
    if (state.revealedCards.length >= state.answerCards.length) break;
  }
}

function renderAll() {
  renderRoundStatus();
  renderAttemptPips();
  renderClues();
  renderTraitChips();
  renderGuesses();
  renderPortrait();
  renderHints();
  renderStats();
  els.guessInput.disabled = state.gameOver;
  els.guessButton.disabled = state.gameOver;
  els.randomGuessButton.disabled = state.gameOver;
}

function renderRoundStatus() {
  if (!state.answer) {
    els.roundStatus.textContent = "Loading player data...";
    return;
  }

  if (state.gameOver) {
    els.roundStatus.textContent = state.guesses.at(-1)?.player.player_key === state.answer.player_key
      ? "Solved."
      : "Answer revealed.";
    return;
  }

  const remaining = MAX_ATTEMPTS - state.guesses.length;
  els.roundStatus.textContent = `${remaining} ${remaining === 1 ? "guess" : "guesses"} left.`;
}

function renderAttemptPips() {
  els.attemptPips.innerHTML = "";
  const solved = state.gameOver && state.guesses.at(-1)?.player.player_key === state.answer?.player_key;

  for (let index = 0; index < MAX_ATTEMPTS; index += 1) {
    const pip = document.createElement("span");
    pip.className = "attempt-pip";
    if (index < state.guesses.length) pip.classList.add(solved ? "win" : "used");
    els.attemptPips.appendChild(pip);
  }
}

function renderClues() {
  els.clueList.innerHTML = "";

  if (!state.revealedCards.length) {
    const item = document.createElement("li");
    item.className = "clue-card";
    item.textContent = "No scouting report clues available.";
    els.clueList.appendChild(item);
    return;
  }

  const card = state.revealedCards[state.revealedCards.length - 1];
  const item = document.createElement("li");
  item.className = "clue-card";
  item.innerHTML = `
    <blockquote id="typewriterText"></blockquote>
    <footer>
      <span>Clue ${state.revealedCards.length}</span>
      <span>${escapeHtml(card.trait_label || "Scouting")}</span>
      <span>${escapeHtml(formatQuality(card.trait_quality))}</span>
    </footer>
  `;
  els.clueList.appendChild(item);

  if (state.typewriterCardId !== card.card_id) {
    startTypewriter(card);
  } else {
    updateTypewriterText();
  }
}

function renderTraitChips() {
  const chips = getRevealedTraits();
  els.traitChips.innerHTML = "";

  if (!chips.length) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = "Traits unlock with clues";
    els.traitChips.appendChild(chip);
    return;
  }

  for (const chipData of chips) {
    const chip = document.createElement("span");
    chip.className = `chip ${chipData.quality || ""}`;
    chip.textContent = `${chipData.label} - ${formatQuality(chipData.quality)}`;
    els.traitChips.appendChild(chip);
  }
}

function getRevealedTraits() {
  const byKey = new Map();

  for (const card of state.revealedCards) {
    const key = `${card.trait_family}|${card.trait_quality}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        label: card.trait_label || "Scouting",
        quality: card.trait_quality || "not_discussed"
      });
    }
  }

  return [...byKey.values()];
}

function renderGuesses() {
  els.guessCountLabel.textContent = `${state.guesses.length} of ${MAX_ATTEMPTS}`;
  els.feedbackPanel.hidden = state.guesses.length === 0 && !state.gameOver;
  els.guessTableBody.innerHTML = "";

  if (!state.guesses.length) {
    const row = document.createElement("tr");
    row.className = "empty-row";
    row.innerHTML = '<td colspan="6">No guesses yet.</td>';
    els.guessTableBody.appendChild(row);
    return;
  }

  for (const guess of state.guesses) {
    const row = document.createElement("tr");
    const evaluation = guess.evaluation;
    row.innerHTML = `
      <td data-label="Player">
        <span class="guess-player">
          ${escapeHtml(guess.player.player_name)}
          <span>${escapeHtml(formatDraftMeta(guess.player))}</span>
        </span>
      </td>
      ${resultCell(evaluation.firstInitial, "First")}
      ${resultCell(evaluation.surnameInitial, "Last")}
      ${resultCell(evaluation.draftYear, "Year")}
      ${resultCell(evaluation.pick, "Pick")}
      ${resultCell(evaluation.round, "Round")}
    `;
    els.guessTableBody.appendChild(row);
  }
}

function resultCell(result, label) {
  return `<td data-label="${label}"><span class="result-cell ${result.status}">${escapeHtml(result.label)}</span></td>`;
}

function renderPortrait() {
  const answer = state.answer;
  if (!answer) return;

  const shouldReveal = state.gameOver;
  const imagePath = answer.headshot_package_relative_file
    ? `${HANDOFF_DIR}/${answer.headshot_package_relative_file}`
    : "";

  els.portraitFrame.classList.toggle("locked", !shouldReveal);
  els.portraitFrame.classList.toggle("revealed", shouldReveal);
  els.portraitFrame.classList.toggle("has-image", Boolean(imagePath));

  if (imagePath && els.playerHeadshot.getAttribute("src") !== imagePath) {
    els.playerHeadshot.hidden = false;
    els.playerHeadshot.src = imagePath;
  } else if (!imagePath) {
    els.playerHeadshot.hidden = true;
    els.playerHeadshot.removeAttribute("src");
  }

  els.portraitFallback.textContent = shouldReveal
    ? `${answer.player_initial || ""}${answer.surname_initial || ""}`
    : "?";

  els.answerSummary.hidden = !shouldReveal;
  if (shouldReveal) {
    els.answerName.textContent = answer.player_name;
    els.answerMeta.textContent = formatAnswerMeta(answer);
  }
}

function handleHeadshotError() {
  els.playerHeadshot.hidden = true;
  els.portraitFrame.classList.remove("has-image");
}

function renderHints() {
  const answer = state.answer;
  if (!answer) return;

  const attempts = state.guesses.length;
  const shouldShowHints = attempts > 0 || state.gameOver;
  els.hintsPanel.hidden = !shouldShowHints;
  if (!shouldShowHints) {
    els.hintProgress.textContent = "0 unlocked";
    els.hintList.innerHTML = "";
    els.traitChips.innerHTML = "";
    return;
  }

  const hints = [
    {
      label: "Scouting traits",
      unlockAt: 0,
      value: getRevealedTraits().map((trait) => trait.label).join(", ") || "Waiting for first clue"
    },
    {
      label: "Draft class",
      unlockAt: 2,
      value: Number.isFinite(answer.draft_year) ? `${answer.draft_year}` : "Unknown"
    },
    {
      label: "Draft range",
      unlockAt: 3,
      value: formatPickBand(answer)
    },
    {
      label: "Outcome",
      unlockAt: 4,
      value: answer.outcome_bucket || formatResultTier(answer.xrapm_result_tier) || "Unknown"
    },
    {
      label: "Initials",
      unlockAt: 5,
      value: `${answer.player_initial}.${answer.surname_initial}.`
    }
  ];

  let unlocked = 0;
  els.hintList.innerHTML = "";

  for (const hint of hints) {
    const isUnlocked = state.gameOver || attempts >= hint.unlockAt;
    if (isUnlocked) unlocked += 1;

    const item = document.createElement("div");
    item.className = `hint-item${isUnlocked ? "" : " locked"}`;
    item.innerHTML = `
      <div class="hint-title">
        <span>${escapeHtml(hint.label)}</span>
        <span>${isUnlocked ? "Unlocked" : `After ${hint.unlockAt} guesses`}</span>
      </div>
      <div class="hint-value">${escapeHtml(isUnlocked ? hint.value : "Locked")}</div>
    `;
    els.hintList.appendChild(item);
  }

  els.hintProgress.textContent = `${unlocked} unlocked`;
}

function startTypewriter(card) {
  resetTypewriter();
  state.typewriterCardId = card.card_id;
  const fullText = card.clean_phrase || "";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    state.typewriterText = fullText;
    updateTypewriterText();
    return;
  }

  let index = 0;
  state.typewriterTimer = window.setInterval(() => {
    index = Math.min(fullText.length, index + 3);
    state.typewriterText = fullText.slice(0, index);
    updateTypewriterText();

    if (index >= fullText.length) {
      window.clearInterval(state.typewriterTimer);
      state.typewriterTimer = null;
    }
  }, 18);
}

function resetTypewriter() {
  if (state.typewriterTimer) {
    window.clearInterval(state.typewriterTimer);
  }
  state.typewriterTimer = null;
  state.typewriterCardId = "";
  state.typewriterText = "";
}

function updateTypewriterText() {
  const target = document.querySelector("#typewriterText");
  if (!target) return;
  target.textContent = state.typewriterText;
}

function renderStats() {
  const stats = state.stats;
  const winRate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;

  els.statPlayed.textContent = String(stats.played);
  els.statWinRate.textContent = `${winRate}%`;
  els.statStreak.textContent = String(stats.streak);
}

function recordGame(won) {
  if (state.recorded) return;

  const stats = state.stats;
  stats.played += 1;
  if (won) {
    stats.wins += 1;
    stats.streak += 1;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    const attempt = String(state.guesses.length);
    stats.distribution[attempt] = (stats.distribution[attempt] || 0) + 1;
  } else {
    stats.streak = 0;
  }

  state.recorded = true;
  saveStats(stats);
}

function loadStats() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("No stats");
    const parsed = JSON.parse(raw);
    return {
      played: parsed.played || 0,
      wins: parsed.wins || 0,
      streak: parsed.streak || 0,
      bestStreak: parsed.bestStreak || 0,
      distribution: parsed.distribution || {}
    };
  } catch {
    return {
      played: 0,
      wins: 0,
      streak: 0,
      bestStreak: 0,
      distribution: {}
    };
  }
}

function saveStats(stats) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

function formatQuality(quality) {
  return QUALITY_LABELS[quality] || titleCase(String(quality || "Context").replaceAll("_", " "));
}

function formatDraftMeta(player) {
  const year = Number.isFinite(player.draft_year) ? player.draft_year : "Year unknown";
  if (isUndrafted(player)) return `${year} draft, Undrafted`;

  const pick = Number.isFinite(player.actual_pick) ? `#${Math.round(player.actual_pick)}` : player.actual_pick_display || "Pick unknown";
  const round = player.round_display && player.round_display !== "Undrafted" ? `, ${player.round_display}` : "";
  return `${year} draft, ${pick}${round}`;
}

function formatAnswerMeta(player) {
  const pieces = [
    formatDraftMeta(player),
    player.draft_college ? player.draft_college : null,
    player.outcome_bucket ? player.outcome_bucket : null
  ].filter(Boolean);

  return pieces.join(" | ");
}

function formatPickBand(player) {
  const pick = toNumber(player.actual_pick);
  if (!Number.isFinite(pick)) {
    return isUndrafted(player) ? "Undrafted" : "Pick unknown";
  }

  if (pick <= 5) return "Top 5";
  if (pick <= 14) return "Lottery";
  if (pick <= 30) return "Rest of 1st round";
  if (pick <= 45) return "Early 2nd round";
  if (pick <= 60) return "Late 2nd round";
  return "Undrafted";
}

function isUndrafted(player) {
  const status = String(player?.draft_status || "").toLowerCase();
  const round = String(player?.round_display || "").toLowerCase();
  const pickDisplay = String(player?.actual_pick_display || "").toLowerCase();
  return (
    status.includes("undrafted") ||
    status.includes("udfa") ||
    round.includes("undrafted") ||
    round.includes("udfa") ||
    pickDisplay.includes("undrafted") ||
    pickDisplay.includes("udfa")
  );
}

function formatResultTier(tier) {
  if (!tier) return "";
  return titleCase(String(tier).replaceAll("_", " "));
}

function setMessage(text, type = "") {
  els.message.textContent = text;
  els.message.className = `form-message ${type}`.trim();
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstLetter(name) {
  const normalized = normalizeSearch(name);
  return normalized ? normalized[0].toUpperCase() : "";
}

function surnameLetter(name) {
  const parts = normalizeSearch(name).split(" ").filter(Boolean);
  return parts.length ? parts[parts.length - 1][0].toUpperCase() : "";
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return NaN;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function randomInt(max) {
  if (window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return values[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function titleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function installSmokeHooks() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("smoke")) return;

  window.__guessThePlayerSmoke = {
    getAnswerName() {
      return state.answer?.player_name || "";
    },
    getAnswerKey() {
      return state.answer?.player_key || "";
    },
    pickWrongPlayerName() {
      return state.players.find((player) => player.player_key !== state.answer?.player_key)?.player_name || "";
    },
    startStableRound() {
      const answer = state.playablePlayers.find((player) => {
        return player.headshot_package_relative_file && prepareCardsForPlayer(player).length >= 3;
      }) || state.playablePlayers[0];
      startRound(answer);
      return answer?.player_name || "";
    },
    startRoundByKey(playerKey) {
      const answer = state.playablePlayers.find((player) => player.player_key === playerKey);
      if (!answer) return "";
      startRound(answer);
      return answer.player_name;
    },
    getPreparedCluesForPlayer(playerKey) {
      const player = state.playerByKey.get(playerKey);
      if (!player) return [];
      return prepareCardsForPlayer(player).map((card) => card.clean_phrase);
    },
    getDraftMetaForPlayer(playerKey) {
      const player = state.playerByKey.get(playerKey);
      return player ? formatDraftMeta(player) : "";
    },
    getVisibleState() {
      return {
        gameOver: state.gameOver,
        guesses: state.guesses.length,
        revealedClues: state.revealedCards.length,
        currentClue: state.revealedCards.at(-1)?.clean_phrase || "",
        headshotSrc: els.playerHeadshot.getAttribute("src"),
        portraitLocked: els.portraitFrame.classList.contains("locked"),
        answerHidden: els.answerSummary.hidden,
        hintsHidden: els.hintsPanel.hidden,
        message: els.message.textContent
      };
    }
  };
}
