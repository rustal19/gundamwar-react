import React, { useEffect, useMemo } from "react";
import { getRoundLabel } from "../utils/tournament/roundLabel";

export default function RoundTabs({ rounds, selectedRoundNumber, onChange, className = "" }) {
  const items = useMemo(
    () =>
      (Array.isArray(rounds) ? rounds : [])
        .slice()
        .sort((left, right) => Number(left.number) - Number(right.number)),
    [rounds]
  );
  const latestRoundNumber = items.length ? items[items.length - 1].number : null;

  useEffect(() => {
    if (!items.length) return;
    const exists = items.some((round) => Number(round.number) === Number(selectedRoundNumber));
    if (!exists && latestRoundNumber != null) {
      onChange(latestRoundNumber);
    }
  }, [items, latestRoundNumber, onChange, selectedRoundNumber]);

  if (!items.length) return null;

  return (
    <div className={`round-tabs ${className}`.trim()} aria-label="ラウンド切替">
      {items.map((round) => (
        <button
          key={round.id || round.number}
          type="button"
          className={`${Number(selectedRoundNumber) === Number(round.number) ? "active" : ""} ${
            round.isCurrent ? "current" : ""
          }`.trim()}
          onClick={() => onChange(round.number)}
        >
          {round.isCurrent ? <span className="round-tab-dot" aria-hidden="true" /> : null}
          {getRoundLabel(round, items)}
          {round.isCurrent ? <span className="round-tab-current-label">(進行中)</span> : null}
        </button>
      ))}
    </div>
  );
}
