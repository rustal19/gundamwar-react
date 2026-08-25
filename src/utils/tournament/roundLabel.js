import { getSwissRoundCount } from "./swiss";

function roundNumber(round) {
  const number = Number(round?.number);
  return Number.isFinite(number) ? number : null;
}

function topCutRoundNumber(round, rounds) {
  const targetNumber = roundNumber(round);
  if (targetNumber == null) return null;

  const topCutNumbers = [...(Array.isArray(rounds) ? rounds : []), round]
    .filter((item) => item?.stage === "top_cut")
    .map(roundNumber)
    .filter((number) => number != null)
    .filter((number, index, numbers) => numbers.indexOf(number) === index)
    .sort((left, right) => left - right);

  const index = topCutNumbers.indexOf(targetNumber);
  return index >= 0 ? index + 1 : null;
}

export function getRoundLabel(round, rounds = []) {
  if (!round || round.number == null) return "ラウンド";
  if (round.stage !== "top_cut") return `第${round.number}回戦`;

  const stageNumber = topCutRoundNumber(round, rounds);
  return stageNumber == null ? "SE回戦" : `SE${stageNumber}回戦`;
}

export function getRoundProgressLabel(round, rounds = [], tournament = {}) {
  const label = getRoundLabel(round, rounds);
  if (!round || round.number == null || round.stage === "top_cut") return label;

  const swissRoundCount = getSwissRoundCount(tournament);
  return swissRoundCount ? `${label} / 全${swissRoundCount}回戦` : label;
}

export function getRoundLabelForNumber(number, rounds = [], tournament = {}) {
  const knownRound = (Array.isArray(rounds) ? rounds : []).find(
    (round) => Number(round.number) === Number(number)
  );
  if (knownRound) return getRoundLabel(knownRound, rounds);

  const isProjectedTopCut =
    tournament.format === "single_elim" ||
    (Number(tournament.topCutSize) > 0 &&
      Number(tournament.swissRounds) > 0 &&
      Number(number) > Number(tournament.swissRounds));
  return getRoundLabel(
    { number, stage: isProjectedTopCut ? "top_cut" : "swiss" },
    rounds
  );
}
