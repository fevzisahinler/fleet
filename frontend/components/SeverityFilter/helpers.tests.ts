import {
  ANY_SEVERITY_OPTION,
  findOptionBySeverityRange,
  isSeverityActive,
  SEVERITY_DROPDOWN_OPTIONS,
  SEVERITY_RANGE_INVALID_MSG,
  SEVERITY_SCORE_RANGE_ERROR,
  severityValueLabel,
  validateSeverityScores,
} from "./helpers";

describe("findOptionBySeverityRange", () => {
  it("treats an empty range as Any severity", () => {
    expect(findOptionBySeverityRange(undefined, undefined)).toBe(
      ANY_SEVERITY_OPTION
    );
  });

  it("matches a preset when both bounds line up", () => {
    expect(findOptionBySeverityRange(7, 8.9).value).toBe("high");
    expect(findOptionBySeverityRange(9, 10).value).toBe("critical");
    expect(findOptionBySeverityRange(0, 10).value).toBe("any");
  });

  it("falls back to Custom, filling in the missing bound", () => {
    const option = findOptionBySeverityRange(7, undefined);
    expect(option.value).toBe("custom");
    expect(option.minSeverity).toBe(7);
    expect(option.maxSeverity).toBe(10);
  });

  it("treats an explicit 0 bound as a real bound, not a missing one", () => {
    // A falsy-coalescing fallback here would widen `max: 0` to 10 — turning
    // "only score 0.0" into "everything".
    expect(findOptionBySeverityRange(undefined, 0)).toMatchObject({
      value: "custom",
      minSeverity: 0,
      maxSeverity: 0,
    });
    expect(findOptionBySeverityRange(0, 6.5)).toMatchObject({
      value: "custom",
      minSeverity: 0,
      maxSeverity: 6.5,
    });
  });
});

describe("isSeverityActive", () => {
  it("is false for Any severity", () => {
    expect(isSeverityActive("any", "", "")).toBe(false);
  });

  it("is true for any preset", () => {
    expect(isSeverityActive("critical", "", "")).toBe(true);
    expect(isSeverityActive("low", "", "")).toBe(true);
  });

  it("is true for Custom only once a bound is entered", () => {
    expect(isSeverityActive("custom", "", "")).toBe(false);
    expect(isSeverityActive("custom", "2.5", "")).toBe(true);
    expect(isSeverityActive("custom", "", "6")).toBe(true);
    // 0 is a bound, not an absence of one.
    expect(isSeverityActive("custom", "0", "")).toBe(true);
  });
});

describe("severityValueLabel", () => {
  it("names the band for each preset", () => {
    expect(severityValueLabel("critical", "", "")).toBe("Critical (9.0 to 10)");
    expect(severityValueLabel("high", "", "")).toBe("High (7.0 to 8.9)");
    expect(severityValueLabel("medium", "", "")).toBe("Medium (4.0 to 6.9)");
    expect(severityValueLabel("low", "", "")).toBe("Low (0.1 to 3.9)");
  });

  it("keeps the range in step with the bounds the preset actually sends", () => {
    // The display text is written out by hand to preserve the band's
    // conventional precision, so guard it against drifting from the numbers.
    SEVERITY_DROPDOWN_OPTIONS.filter((o) => o.rangeLabel).forEach((option) => {
      const [min, max] = (option.rangeLabel as string).split(" to ");
      expect(Number(min)).toBe(option.minSeverity);
      expect(Number(max)).toBe(option.maxSeverity);
    });
  });

  it("leaves Any severity as-is", () => {
    expect(severityValueLabel("any", "", "")).toBe("Any severity");
  });

  it("reflects the entered range for Custom", () => {
    expect(severityValueLabel("custom", "2.5", "6")).toBe("Custom (2.5 to 6)");
  });

  it("widens a half-open Custom range to the end of the scale", () => {
    expect(severityValueLabel("custom", "2.5", "")).toBe("Custom (2.5 to 10)");
    expect(severityValueLabel("custom", "", "6")).toBe("Custom (0 to 6)");
    // 0 is a bound, so it reads as one rather than widening.
    expect(severityValueLabel("custom", "0", "0")).toBe("Custom (0 to 0)");
  });

  it("names no range for Custom until a bound is entered", () => {
    expect(severityValueLabel("custom", "", "")).toBe("Custom");
  });
});

describe("validateSeverityScores", () => {
  it("returns no errors for empty or valid scores", () => {
    expect(validateSeverityScores({ minScore: "", maxScore: "" })).toEqual({});
    expect(
      validateSeverityScores({ minScore: "0.1", maxScore: "9.9" })
    ).toEqual({});
  });

  it("flags out-of-range and over-precise scores per field", () => {
    expect(validateSeverityScores({ minScore: "11", maxScore: "" })).toEqual({
      minScore: SEVERITY_SCORE_RANGE_ERROR,
    });
    expect(validateSeverityScores({ minScore: "", maxScore: "5.55" })).toEqual({
      maxScore: SEVERITY_SCORE_RANGE_ERROR,
    });
  });

  it("flags an inverted range only when both bounds are individually valid", () => {
    expect(validateSeverityScores({ minScore: "7", maxScore: "3" })).toEqual({
      rangeInvalid: SEVERITY_RANGE_INVALID_MSG,
    });
    // The per-field error takes precedence over the range check.
    expect(validateSeverityScores({ minScore: "11", maxScore: "3" })).toEqual({
      minScore: SEVERITY_SCORE_RANGE_ERROR,
    });
  });
});
