export const TOURNAMENT_STATUS_LABELS = {
  draft: "下書き",
  registration: "受付中",
  in_progress: "進行中",
  completed: "完了",
  cancelled: "中止",
};

export const TOURNAMENT_STATUS_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "registration", label: TOURNAMENT_STATUS_LABELS.registration },
  { value: "in_progress", label: TOURNAMENT_STATUS_LABELS.in_progress },
  { value: "completed", label: TOURNAMENT_STATUS_LABELS.completed },
  { value: "cancelled", label: TOURNAMENT_STATUS_LABELS.cancelled },
];

export const ROUND_STATUS_LABELS = {
  in_progress: "進行中",
  completed: "完了",
};
