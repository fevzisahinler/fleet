export const ANY_SEVERITY_VALUE = "any";
export const CUSTOM_SEVERITY_VALUE = "custom";

/** Every value the severity dropdown can hold. */
export type SeverityValue =
  | "any"
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "custom";

export const SEVERITY_HELP_TEXT =
  "CVSS scores (v3) range from 0.0 to 10.0 in 0.1 increments.";

export interface ISeverityOption {
  label: string;
  value: SeverityValue;
  helpText: string;
  /** Bounds the option applies. Undefined on Custom, which reads the inputs. */
  minSeverity?: number;
  maxSeverity?: number;
  /** The band as the closed control spells it, e.g. "9.0 to 10". Written out
   * rather than derived from minSeverity/maxSeverity so the display keeps the
   * band's conventional precision (9.0, not 9). Omitted on Any (which spans
   * everything) and on Custom (whose range comes from the score inputs). */
  rangeLabel?: string;
}

/** The severity selection a parent holds. Scores are raw input strings. */
export interface ISeverityFilterValue {
  severity: SeverityValue;
  minScore: string;
  maxScore: string;
}

export const CUSTOM_SEVERITY_OPTION: ISeverityOption = {
  label: "Custom severity",
  value: CUSTOM_SEVERITY_VALUE,
  helpText: "Custom CVSS score range",
  minSeverity: undefined,
  maxSeverity: undefined,
};

export const ANY_SEVERITY_OPTION: ISeverityOption = {
  label: "Any severity",
  value: ANY_SEVERITY_VALUE,
  helpText: "CVSS score 0-10",
  minSeverity: 0,
  maxSeverity: 10,
};

export const SEVERITY_DROPDOWN_OPTIONS: ISeverityOption[] = [
  ANY_SEVERITY_OPTION,
  {
    label: "Critical severity",
    value: "critical",
    helpText: "CVSS score 9.0-10",
    minSeverity: 9.0,
    maxSeverity: 10,
    rangeLabel: "9.0 to 10",
  },
  {
    label: "High severity",
    value: "high",
    helpText: "CVSS score 7.0-8.9",
    minSeverity: 7.0,
    maxSeverity: 8.9,
    rangeLabel: "7.0 to 8.9",
  },
  {
    label: "Medium severity",
    value: "medium",
    helpText: "CVSS score 4.0-6.9",
    minSeverity: 4.0,
    maxSeverity: 6.9,
    rangeLabel: "4.0 to 6.9",
  },
  {
    label: "Low severity",
    value: "low",
    helpText: "CVSS score 0.1-3.9",
    minSeverity: 0.1,
    maxSeverity: 3.9,
    rangeLabel: "0.1 to 3.9",
  },
  CUSTOM_SEVERITY_OPTION,
];

/** What callers of findOptionBySeverityRange consume — the dropdown renders
 * from SEVERITY_DROPDOWN_OPTIONS, so a resolved range needs no display text. */
export type ISeverityRange = Pick<
  ISeverityOption,
  "value" | "minSeverity" | "maxSeverity"
>;

/**
 * Resolves a min/max CVSS pair to the option that represents it: a preset when
 * both bounds line up, Any when neither bound is set, and Custom otherwise.
 * A missing bound in a Custom range widens to that end of the scale, but an
 * explicit 0 is a real bound — `cvss_max: 0` means "only 0.0", not "up to 10".
 */
export const findOptionBySeverityRange = (
  minSeverityValue: number | undefined,
  maxSeverityValue: number | undefined
): ISeverityRange => {
  if (
    (minSeverityValue === undefined || minSeverityValue === null) &&
    (maxSeverityValue === undefined || maxSeverityValue === null)
  ) {
    return ANY_SEVERITY_OPTION;
  }

  return (
    SEVERITY_DROPDOWN_OPTIONS.find(
      (option) =>
        option.minSeverity === minSeverityValue &&
        option.maxSeverity === maxSeverityValue
    ) ?? {
      value: CUSTOM_SEVERITY_VALUE,
      minSeverity: minSeverityValue ?? 0,
      maxSeverity: maxSeverityValue ?? 10,
    }
  );
};

/**
 * True when the selection actually narrows results, which is what the "filtered"
 * affordances (pills, filter counts, summary lines) should key on. Any severity
 * spans the whole scale, and Custom with neither bound entered constrains
 * nothing either — both send no bounds to the API.
 */
export const isSeverityActive = (
  severity: SeverityValue,
  minScore: string,
  maxScore: string
): boolean => {
  if (severity === ANY_SEVERITY_VALUE) {
    return false;
  }
  if (severity === CUSTOM_SEVERITY_VALUE) {
    return minScore !== "" || maxScore !== "";
  }
  return true;
};

/**
 * The text the closed dropdown shows for the current selection, naming the
 * CVSS range so the active filter is legible without opening the menu:
 * "Critical (9.0 to 10)". The menu keeps the plain option labels.
 *
 * Any severity spans the whole scale, so it stays "Any severity" rather than
 * advertising a range it doesn't narrow. Custom reads the score inputs, and a
 * bound left empty widens to that end of the scale — the same widening
 * findOptionBySeverityRange applies — so "2.5 to 10" for a min-only range.
 * With nothing entered there is no range to name yet, so it reads "Custom".
 */
export const severityValueLabel = (
  severity: SeverityValue,
  minScore: string,
  maxScore: string
): string => {
  const option = SEVERITY_DROPDOWN_OPTIONS.find((o) => o.value === severity);
  if (!option) {
    return "";
  }
  // Every option label reads "<name> severity"; the range takes the suffix's
  // place, so "Critical severity" becomes "Critical (9.0 to 10)".
  const name = option.label.replace(/ severity$/, "");

  if (severity === CUSTOM_SEVERITY_VALUE) {
    if (!isSeverityActive(severity, minScore, maxScore)) {
      return name;
    }
    const min = minScore === "" ? 0 : Number(minScore);
    const max = maxScore === "" ? 10 : Number(maxScore);
    return `${name} (${min} to ${max})`;
  }

  return option.rangeLabel ? `${name} (${option.rangeLabel})` : option.label;
};

export const SEVERITY_SCORE_RANGE_ERROR = "Must be from 0-10 in 0.1 increments";
export const SEVERITY_RANGE_INVALID_MSG =
  "Minimum CVSS score cannot be greater than the maximum CVSS score.";

export interface ISeverityScores {
  minScore: string;
  maxScore: string;
}

export interface ISeverityScoreErrors {
  minScore?: string;
  maxScore?: string;
  /** Set when both bounds are individually valid but inverted (min > max). */
  rangeInvalid?: string;
}

// parseFloat yields NaN — never undefined — for unparseable input, so the
// isFinite check inside this is what rejects non-numeric entries.
const hasAtMostOneDecimal = (n: number) =>
  Number.isFinite(n) && Number((n * 10).toFixed(0)) / 10 === n;

const isBetween0and10 = (n: number) => n >= 0 && n <= 10;

const isValidScore = (n: number) =>
  hasAtMostOneDecimal(n) && isBetween0and10(n);

/**
 * Validates a raw min/max CVSS score pair. Empty strings are "unset" and never
 * error. Consumers decide what to do with the result — the filter renders the
 * per-field errors, and each parent decides whether to block its own submit.
 */
export const validateSeverityScores = ({
  minScore,
  maxScore,
}: ISeverityScores): ISeverityScoreErrors => {
  const errors: ISeverityScoreErrors = {};
  const min = minScore ? parseFloat(minScore) : undefined;
  const max = maxScore ? parseFloat(maxScore) : undefined;

  if (min !== undefined && !isValidScore(min)) {
    errors.minScore = SEVERITY_SCORE_RANGE_ERROR;
  }
  if (max !== undefined && !isValidScore(max)) {
    errors.maxScore = SEVERITY_SCORE_RANGE_ERROR;
  }
  // Only meaningful once both bounds are individually valid — otherwise the
  // per-field error is the more useful thing to report.
  if (
    min !== undefined &&
    max !== undefined &&
    !errors.minScore &&
    !errors.maxScore &&
    min > max
  ) {
    errors.rangeInvalid = SEVERITY_RANGE_INVALID_MSG;
  }
  return errors;
};
