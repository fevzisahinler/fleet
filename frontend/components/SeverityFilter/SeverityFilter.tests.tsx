import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import { noop } from "lodash";

import { renderWithSetup } from "test/test-utils";

import SeverityFilter, { ISeverityFilterValue } from "./SeverityFilter";
import { validateSeverityScores } from "./helpers";

/**
 * SeverityFilter is controlled, so the regression guards below need real state:
 * an errant severity change has to be able to unmount the score inputs for the
 * test to catch it.
 */
const ControlledSeverityFilter = ({
  severity = "any",
  minScore = "",
  maxScore = "",
  onChange,
  validate = false,
}: Partial<ISeverityFilterValue> & {
  onChange?: (next: ISeverityFilterValue) => void;
  validate?: boolean;
}) => {
  const [value, setValue] = useState<ISeverityFilterValue>({
    severity,
    minScore,
    maxScore,
  });

  return (
    <SeverityFilter
      {...value}
      errors={validate ? validateSeverityScores(value) : undefined}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
};

// react-select renders its options as plain divs, so target them by the
// testid the shared custom Option component sets rather than by role.
const selectSeverity = async (
  user: ReturnType<typeof renderWithSetup>["user"],
  label: string
) => {
  await user.click(screen.getByRole("combobox", { name: "Severity" }));
  const option = screen
    .getAllByTestId("dropdown-option")
    .find((el) => el.textContent?.startsWith(label));
  if (!option) {
    throw new Error(`No severity option matching "${label}"`);
  }
  await user.click(option);
};

const getMinInput = () => screen.getByLabelText(/Min score/i);
const getMaxInput = () => screen.getByLabelText(/Max score/i);
const querySeverityLabel = (label: RegExp) => screen.queryByText(label);

describe("SeverityFilter", () => {
  it("renders the dropdown with its tooltip label and help text", () => {
    render(
      <SeverityFilter severity="any" minScore="" maxScore="" onChange={noop} />
    );

    expect(screen.getByText("Severity")).toBeInTheDocument();
    expect(
      screen.getByText(
        "CVSS scores (v3) range from 0.0 to 10.0 in 0.1 increments."
      )
    ).toBeInTheDocument();
  });

  describe("closed control names the CVSS range", () => {
    it("shows the band alongside the preset name", () => {
      render(
        <SeverityFilter
          severity="critical"
          minScore=""
          maxScore=""
          onChange={noop}
        />
      );

      expect(screen.getByText("Critical (9.0 to 10)")).toBeInTheDocument();
      expect(screen.queryByText("Critical severity")).not.toBeInTheDocument();
    });

    it("leaves Any severity alone, since it narrows nothing", () => {
      render(
        <SeverityFilter
          severity="any"
          minScore=""
          maxScore=""
          onChange={noop}
        />
      );

      expect(screen.getByText("Any severity")).toBeInTheDocument();
    });

    it("reflects the typed range for Custom", () => {
      render(
        <SeverityFilter
          severity="custom"
          minScore="2.5"
          maxScore="6"
          onChange={noop}
        />
      );

      expect(screen.getByText("Custom (2.5 to 6)")).toBeInTheDocument();
    });

    it("keeps the plain labels in the menu", async () => {
      const { user } = renderWithSetup(
        <ControlledSeverityFilter severity="critical" />
      );

      await user.click(screen.getByRole("combobox", { name: "Severity" }));
      const optionText = screen
        .getAllByTestId("dropdown-option")
        .map((el) => el.textContent);

      // The menu still carries its own "CVSS score 9.0-10" help text, so
      // repeating the range in the option name would just duplicate it.
      expect(optionText.some((t) => t?.startsWith("Critical severity"))).toBe(
        true
      );
      expect(optionText.some((t) => t?.includes("Critical (9.0 to 10)"))).toBe(
        false
      );
    });
  });

  it("hides the score inputs for every preset and shows them only for Custom", async () => {
    const { user } = renderWithSetup(<ControlledSeverityFilter />);

    // Any severity (the initial preset)
    expect(screen.queryByLabelText(/Min score/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Max score/i)).not.toBeInTheDocument();

    await selectSeverity(user, "Critical severity");
    expect(screen.queryByLabelText(/Min score/i)).not.toBeInTheDocument();

    await selectSeverity(user, "High severity");
    expect(screen.queryByLabelText(/Min score/i)).not.toBeInTheDocument();

    await selectSeverity(user, "Medium severity");
    expect(screen.queryByLabelText(/Min score/i)).not.toBeInTheDocument();

    await selectSeverity(user, "Low severity");
    expect(screen.queryByLabelText(/Min score/i)).not.toBeInTheDocument();

    await selectSeverity(user, "Custom severity");
    expect(getMinInput()).toBeInTheDocument();
    expect(getMaxInput()).toBeInTheDocument();
  });

  it("populates min/max from the selected preset", async () => {
    const onChange = jest.fn();
    const { user } = renderWithSetup(
      <ControlledSeverityFilter onChange={onChange} />
    );

    await selectSeverity(user, "High severity");

    expect(onChange).toHaveBeenLastCalledWith({
      severity: "high",
      minScore: "7",
      maxScore: "8.9",
    });

    // Switching to Custom surfaces the preset's bounds for refinement.
    await selectSeverity(user, "Custom severity");
    expect(getMinInput()).toHaveValue(7);
    expect(getMaxInput()).toHaveValue(8.9);
  });

  it("clears min/max when Any severity is selected", async () => {
    const onChange = jest.fn();
    const { user } = renderWithSetup(
      <ControlledSeverityFilter
        severity="high"
        minScore="7"
        maxScore="8.9"
        onChange={onChange}
      />
    );

    await selectSeverity(user, "Any severity");

    expect(onChange).toHaveBeenLastCalledWith({
      severity: "any",
      minScore: "",
      maxScore: "",
    });

    await selectSeverity(user, "Custom severity");
    expect(getMinInput()).toHaveValue(null);
    expect(getMaxInput()).toHaveValue(null);
  });

  describe("typing never changes the dropdown", () => {
    const renderCustom = () =>
      renderWithSetup(<ControlledSeverityFilter severity="custom" />);

    // The closed control reads "Custom" or "Custom (min to max)". What matters
    // is that it never re-derives into a preset or Any while typing.
    const expectStillCustom = () => {
      expect(querySeverityLabel(/^Custom\b/)).toBeInTheDocument();
      expect(
        querySeverityLabel(/^(Any|Critical|High|Medium|Low)\b/)
      ).toBeNull();
      expect(getMinInput()).toBeInTheDocument();
      expect(getMaxInput()).toBeInTheDocument();
    };

    it("keeps Custom when typing 0 in Min with Max empty", async () => {
      const { user } = renderCustom();

      await user.type(getMinInput(), "0");

      expectStillCustom();
      expect(getMinInput()).toHaveValue(0);
    });

    it("keeps Custom when typing 9 in Min with Max empty", async () => {
      const { user } = renderCustom();

      await user.type(getMinInput(), "9");

      expectStillCustom();
      expect(getMinInput()).toHaveValue(9);
    });

    it("keeps Custom when typing 10 in Max with Min empty", async () => {
      const { user } = renderCustom();

      await user.type(getMaxInput(), "10");

      expectStillCustom();
      expect(getMaxInput()).toHaveValue(10);
    });

    it("keeps Custom when typing a range that matches a preset", async () => {
      const { user } = renderCustom();

      await user.type(getMinInput(), "7");
      await user.type(getMaxInput(), "8.9");

      expectStillCustom();
      expect(getMinInput()).toHaveValue(7);
      expect(getMaxInput()).toHaveValue(8.9);
    });

    it("keeps Custom when both fields are cleared", async () => {
      const { user } = renderWithSetup(
        <ControlledSeverityFilter
          severity="custom"
          minScore="7"
          maxScore="8.9"
        />
      );

      await user.clear(getMinInput());
      await user.clear(getMaxInput());

      expectStillCustom();
      expect(getMinInput()).toHaveValue(null);
      expect(getMaxInput()).toHaveValue(null);
    });

    it("allows decimal values to be typed one character at a time", async () => {
      const { user } = renderCustom();

      await user.type(getMinInput(), "0.5");
      await user.type(getMaxInput(), "9.5");

      expectStillCustom();
      expect(getMinInput()).toHaveValue(0.5);
      expect(getMaxInput()).toHaveValue(9.5);
    });
  });

  it("surfaces per-field errors from the validation helper", async () => {
    const { user } = renderWithSetup(
      <ControlledSeverityFilter severity="custom" validate />
    );

    await user.type(getMinInput(), "5.55");

    expect(
      screen.getByText("Must be from 0-10 in 0.1 increments")
    ).toBeInTheDocument();
  });

  it("disables the dropdown and the score inputs", () => {
    render(
      <SeverityFilter
        severity="custom"
        minScore=""
        maxScore=""
        onChange={noop}
        disabled
      />
    );

    expect(screen.getByRole("combobox", { name: "Severity" })).toBeDisabled();
    expect(getMinInput()).toBeDisabled();
    expect(getMaxInput()).toBeDisabled();
  });
});
