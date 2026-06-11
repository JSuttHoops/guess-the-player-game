import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const playwrightImport = process.env.PLAYWRIGHT_IMPORT || "playwright";
const smokeUrl = process.env.SMOKE_URL || "http://localhost:5173/?smoke=1";
const screenshotDir = process.env.SMOKE_SCREENSHOT_DIR || "";

let chromium;
try {
  ({ chromium } = await import(playwrightImport));
} catch (error) {
  console.error(`Unable to import Playwright from ${playwrightImport}`);
  console.error(error.message);
  process.exit(2);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await page.goto(smokeUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForReady(page);
  await page.evaluate(() => window.__guessThePlayerSmoke.startStableRound());
  await waitForReady(page);

  const initialState = await page.evaluate(() => window.__guessThePlayerSmoke.getVisibleState());
  assert.equal(initialState.hintsHidden, true, "hints are hidden before the first guess");
  assert.equal(initialState.portraitLocked, true, "portrait starts locked and blurred");
  assertCleanClue(initialState.currentClue);
  await assertKnownClueCleanup(page);

  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(mobileOverflow <= 1, `mobile layout should not overflow horizontally: ${mobileOverflow}`);
  await screenshot(page, "browser-smoke-mobile-ready.png");

  await page.click("#randomGuessButton");
  const randomPick = await page.locator("#guessInput").inputValue();
  assert.ok(randomPick.length > 0, "random button fills a player into the guess input");
  await page.fill("#guessInput", "");

  const undraftedMeta = await page.evaluate(() => window.__guessThePlayerSmoke.getDraftMetaForPlayer("adam flagler"));
  assert.equal(undraftedMeta, "2023 draft, Undrafted", "undrafted players render clean draft metadata");

  await page.fill("#guessInput", "JV");
  await page.waitForSelector(".suggestions.open .suggestion", { timeout: 5000 });
  const initialsSuggestions = await page.locator(".suggestions.open .suggestion").allTextContents();
  assert.ok(
    initialsSuggestions.some((suggestion) => normalizeForTest(suggestion).includes("jonas valan")),
    "initials search surfaces Jonas Valanciunas for JV"
  );
  await page.fill("#guessInput", "");
  await assertContextualInitialsSearch(page);

  const wrongName = await page.evaluate(() => window.__guessThePlayerSmoke.pickWrongPlayerName());
  assert.ok(wrongName, "wrong player candidate is available");

  await page.fill("#guessInput", wrongName.slice(0, Math.min(6, wrongName.length)));
  await page.waitForSelector(".suggestions.open .suggestion", { timeout: 5000 });
  const suggestionCount = await page.locator(".suggestions.open .suggestion").count();
  assert.ok(suggestionCount > 0, "search suggestions open");

  await page.fill("#guessInput", wrongName);
  await page.click("#guessButton");
  await page.waitForFunction(() => window.__guessThePlayerSmoke.getVisibleState().guesses === 1);

  const afterWrongGuess = await page.evaluate(() => window.__guessThePlayerSmoke.getVisibleState());
  assert.ok(afterWrongGuess.headshotSrc, "blurred headshot is present after wrong guess");
  assert.equal(afterWrongGuess.portraitLocked, true, "headshot remains locked after wrong guess");
  assert.equal(afterWrongGuess.answerHidden, true, "answer summary is hidden after wrong guess");
  assert.equal(afterWrongGuess.hintsHidden, false, "hints appear after first guess");
  assert.equal(afterWrongGuess.revealedClues, 2, "second clue unlocks after a miss");
  assertCleanClue(afterWrongGuess.currentClue);
  const hintLabels = await page.locator(".hint-title span:first-child").allTextContents();
  assert.deepEqual(
    hintLabels,
    ["Scouting traits", "Draft class", "Draft range", "Outcome", "Initials"],
    "hints follow the intended reveal order"
  );

  const answerName = await page.evaluate(() => window.__guessThePlayerSmoke.getAnswerName());
  assert.ok(answerName, "answer name is available in smoke mode");

  await page.fill("#guessInput", answerName);
  await page.click("#guessButton");
  await page.waitForFunction(() => window.__guessThePlayerSmoke.getVisibleState().gameOver === true);

  const afterCorrectGuess = await page.evaluate(() => window.__guessThePlayerSmoke.getVisibleState());
  assert.equal(afterCorrectGuess.answerHidden, false, "answer summary appears after correct guess");
  assert.match(afterCorrectGuess.message, /Correct in 2\./, "correct result message appears");
  await screenshot(page, "browser-smoke-mobile-solved.png");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${smokeUrl}&desktop=1`, { waitUntil: "domcontentloaded" });
  await waitForReady(page);
  await page.evaluate(() => window.__guessThePlayerSmoke.startStableRound());
  await waitForReady(page);
  const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(desktopOverflow <= 1, `desktop layout should not overflow horizontally: ${desktopOverflow}`);
  await screenshot(page, "browser-smoke-desktop-ready.png");

  console.log("Browser smoke passed: ready state, search, wrong guess, hidden headshot, solve state, mobile and desktop overflow.");
} finally {
  await browser.close();
}

async function waitForReady(page) {
  await page.waitForFunction(
    () => document.querySelector("#message")?.textContent.includes("Player database ready"),
    null,
    { timeout: 45000 }
  );
}

async function screenshot(page, name) {
  if (!screenshotDir) return;
  mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({ path: join(screenshotDir, name), fullPage: true });
}

function assertCleanClue(clue) {
  assert.ok(clue.length >= 24, "current clue has usable text");
  assert.equal(clue.includes("||"), false, "current clue is not a bundled report blob");
  assert.equal(clue.includes("[PLAYER]"), false, "current clue does not show redaction placeholders");
  assert.doesNotMatch(clue, /\b(?:born\s+)?(?:in|on|at|from)\s*,/i, "current clue does not include date-removal scars");
  assert.doesNotMatch(clue, /\b(?:19|20)\d{2}\b/, "current clue does not include standalone years");
  assert.doesNotMatch(clue, /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}/i, "current clue does not include dates");
  assert.doesNotMatch(clue, /^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3}\s+(?:says|writes|notes|said)\s*:/, "current clue does not start with a scout/source prefix");
  assert.doesNotMatch(clue, /\b(?:a|an|and|as|at|by|for|from|if|in|of|on|or|that|the|to|which|who|with)\.\.\.$/i, "current clue does not end on a dangling connector");
  assert.doesNotMatch(clue, /\b(?:affectiv|becaus|calib|coul|despi|highe|offensiv|shoul|woul)\.\.\.$/i, "current clue does not end on a known partial word");
  assert.doesNotMatch(clue, /\s+[A-Za-z]\.\.\.$/, "current clue does not end on an orphan letter");
  assert.doesNotMatch(clue, /\s+\d+(?:\.\d+)?\.\.\.$/, "current clue does not end on an orphan number");
}

async function assertKnownClueCleanup(page) {
  const bronnyClues = await page.evaluate(() => window.__guessThePlayerSmoke.getPreparedCluesForPlayer("bronny james"));
  assert.ok(bronnyClues.length >= 3, "Bronny James clue fixtures are available");
  assert.ok(
    bronnyClues.some((clue) => clue.includes("can help...")),
    "truncated Bronny clue keeps an intentional trail-off"
  );
  assert.equal(
    bronnyClues.some((clue) => /\bhelp an\.\.\.$/i.test(clue)),
    false,
    "truncated Bronny clue trims the dangling article"
  );

  const jonasClues = await page.evaluate(() => window.__guessThePlayerSmoke.getPreparedCluesForPlayer("jonas valan i nas"));
  assert.equal(
    jonasClues.some((clue) => /\bcoul\.\.\.$/i.test(clue)),
    false,
    "truncated Jonas clue trims partial could stem"
  );

  const aaronGordonClues = await page.evaluate(() => window.__guessThePlayerSmoke.getPreparedCluesForPlayer("aaron gordon"));
  assert.equal(
    aaronGordonClues.some((clue) => clue.includes("[PLAYER]")),
    false,
    "Aaron Gordon clues do not leak redaction placeholders"
  );

  const ramseyClues = await page.evaluate(() => window.__guessThePlayerSmoke.getPreparedCluesForPlayer("jahmi us ramsey"));
  assert.ok(ramseyClues.length >= 3, "Jahmi'us Ramsey clue fixtures are available");
  assert.equal(
    ramseyClues.some((clue) => /Smith is an ideal big|Shai Gilgeous-Alexander/i.test(clue)),
    false,
    "mismatched Smith big-man fragment is removed from Jahmi'us Ramsey clues"
  );
  assert.ok(
    ramseyClues.some((clue) => /scorer.s mentality|guard position|behind the arch/i.test(clue)),
    "legitimate Jahmi'us Ramsey guard/scorer clues remain"
  );

  const detachedSubjectFixture = await page.evaluate(() => {
    return window.__guessThePlayerSmoke.getCleanPhrasesForFixture(
      "jahmi us ramsey",
      "Fresh off a season in which he averaged 15.5 points and 10.5 rebounds, Smith is an ideal big to pair with Shai Gilgeous-Alexander."
    );
  });
  assert.equal(detachedSubjectFixture.length, 0, "detached named-subject clues are removed");

  const contextualPlayerFixture = await page.evaluate(() => {
    return window.__guessThePlayerSmoke.getCleanPhrasesForFixture(
      "jahmi us ramsey",
      "Shai Gilgeous-Alexander is useful context for him as a scoring guard who needs an advantage creator nearby."
    );
  });
  assert.equal(contextualPlayerFixture.length, 1, "named-player context is kept when it relates back to the answer");
  assert.match(contextualPlayerFixture[0], /Shai Gilgeous-Alexander/i, "contextual player name remains visible");
}

async function assertContextualInitialsSearch(page) {
  const started = await page.evaluate(() => window.__guessThePlayerSmoke.startRoundByKey("jonas valan i nas"));
  assert.ok(normalizeForTest(started).includes("jonas valan"), "Jonas Valanciunas smoke round starts");

  await page.fill("#guessInput", "Jan Vesely");
  await page.click("#guessButton");
  await page.waitForFunction(() => window.__guessThePlayerSmoke.getVisibleState().guesses === 1);

  await page.fill("#guessInput", "JV");
  await page.waitForSelector(".suggestions.open .suggestion", { timeout: 5000 });
  const suggestions = await page.locator(".suggestions.open .suggestion").allTextContents();
  assert.ok(
    normalizeForTest(suggestions[0]).includes("jonas valan"),
    "board-aware initials search ranks Jonas first after a matching JV guess"
  );

  await page.evaluate(() => window.__guessThePlayerSmoke.startStableRound());
  await page.waitForFunction(() => window.__guessThePlayerSmoke.getVisibleState().guesses === 0);
}

function normalizeForTest(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
