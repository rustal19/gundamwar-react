const DEFAULT_IDENTIFIER_LENGTH = 4;

function participantName(entry) {
  const value =
    entry?.user?.name ??
    entry?.displayName ??
    entry?.display_name ??
    entry?.guestName ??
    entry?.guest_name ??
    entry?.name;
  if (value == null || value === "") return "";
  return String(value);
}

function participantIdentity(entry, fallbackIndex = 0) {
  const userId = entry?.user?.id ?? entry?.userId ?? entry?.user_id;
  if (userId != null && userId !== "") return `user:${String(userId)}`;

  const entryId = entry?.id ?? entry?.entryId ?? entry?.entry_id;
  if (entryId != null && entryId !== "") return `guest:${String(entryId)}`;

  return `guest-fallback:${participantName(entry)}:${fallbackIndex}`;
}

function hash32(value, initialValue) {
  let hash = initialValue >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function identifierSource(identity) {
  const first = hash32(identity, 2166136261).toString(36).padStart(7, "0");
  const second = hash32(`tournament:${identity}`, 2166136261)
    .toString(36)
    .padStart(7, "0");
  return `${first}${second}`;
}

function uniqueIdentifierLength(identities) {
  const sources = [...new Set(identities)].map(identifierSource);
  if (sources.length < 2) return DEFAULT_IDENTIFIER_LENGTH;

  for (let length = DEFAULT_IDENTIFIER_LENGTH; length <= sources[0].length; length += 1) {
    if (new Set(sources.map((source) => source.slice(0, length))).size === sources.length) {
      return length;
    }
  }

  return sources[0].length;
}

/**
 * Creates a formatter scoped to one tournament's complete entry list.
 * Registered users are keyed by user ID; manual guests are keyed by entry ID.
 */
export function createTournamentParticipantNameFormatter(entries) {
  const items = Array.isArray(entries) ? entries : [];
  const entryIndexes = new Map(items.map((entry, index) => [entry, index]));
  const groups = new Map();

  items.forEach((entry, index) => {
    const name = participantName(entry);
    if (!name) return;
    const group = groups.get(name) || [];
    group.push(participantIdentity(entry, index));
    groups.set(name, group);
  });

  const identifierLengths = new Map();
  groups.forEach((identities, name) => {
    if (identities.length > 1) {
      identifierLengths.set(name, uniqueIdentifierLength(identities));
    }
  });

  return (entry, fallback = "-") => {
    const name = participantName(entry);
    if (!name) return fallback;

    const identifierLength = identifierLengths.get(name);
    if (!identifierLength) return name;

    const identity = participantIdentity(entry, entryIndexes.get(entry) || 0);
    const identifier = identifierSource(identity).slice(0, identifierLength);
    return `${name} #${identifier}`;
  };
}

