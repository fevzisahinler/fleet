import React from "react";
import { FormatOptionLabelMeta, SingleValue } from "react-select-5";

import { IInputFieldParseTarget } from "interfaces/form_field";

import DropdownWrapper from "components/forms/fields/DropdownWrapper";
import { CustomOptionType } from "components/forms/fields/DropdownWrapper/DropdownWrapper";
import InputField from "components/forms/fields/InputField";
import TooltipWrapper from "components/TooltipWrapper";

import {
  ANY_SEVERITY_VALUE,
  CUSTOM_SEVERITY_VALUE,
  ISeverityFilterValue,
  ISeverityScoreErrors,
  SEVERITY_DROPDOWN_OPTIONS,
  SEVERITY_HELP_TEXT,
  severityValueLabel,
} from "./helpers";

const baseClass = "severity-filter";

export type { ISeverityFilterValue };

interface ISeverityFilterProps extends ISeverityFilterValue {
  onChange: (next: ISeverityFilterValue) => void;
  disabled?: boolean;
  errors?: ISeverityScoreErrors;
}

/**
 * Severity (CVSS) filter shared by the Software page, Host details, My device,
 * and the vulnerability exposure chart. Controlled and keyed on the option
 * value so parents keep flat, serializable state.
 *
 * The field names are fixed, so render at most one per page — a second instance
 * would duplicate the dropdown and score input ids and break label association.
 */
const SeverityFilter = ({
  severity,
  minScore,
  maxScore,
  onChange,
  disabled = false,
  errors,
}: ISeverityFilterProps) => {
  const onChangeSeverity = (selected: SingleValue<CustomOptionType>) => {
    const option = SEVERITY_DROPDOWN_OPTIONS.find(
      (o) => o.value === selected?.value
    );
    if (!option) {
      return;
    }
    if (option.value === ANY_SEVERITY_VALUE) {
      onChange({ severity: option.value, minScore: "", maxScore: "" });
      return;
    }
    if (option.value === CUSTOM_SEVERITY_VALUE) {
      // Custom keeps the bounds already in state so the user can refine the
      // preset they came from instead of starting over.
      onChange({ severity: option.value, minScore, maxScore });
      return;
    }
    onChange({
      severity: option.value,
      minScore: option.minSeverity?.toString() ?? "",
      maxScore: option.maxSeverity?.toString() ?? "",
    });
  };

  // Typing must never re-derive the dropdown. The score inputs only render in
  // Custom mode, so any derived severity change would unmount the field the
  // user is typing in — making values like 0.5 impossible to enter.
  const onScoreChange = ({ name, value }: IInputFieldParseTarget) => {
    onChange({ severity, minScore, maxScore, [name]: value as string });
  };

  // Only the closed control names the range; the menu keeps the plain option
  // labels and their per-option help text.
  const formatOptionLabel = (
    option: CustomOptionType,
    { context }: FormatOptionLabelMeta<CustomOptionType>
  ) =>
    context === "value"
      ? severityValueLabel(severity, minScore, maxScore)
      : option.label;

  const renderLabel = () => (
    <TooltipWrapper
      tipContent={
        <>
          The worst case impact across different environments
          <br />
          (CVSS version 3.x base score).
        </>
      }
      clickable={false}
    >
      Severity
    </TooltipWrapper>
  );

  return (
    <div className={baseClass}>
      <DropdownWrapper
        name="severity-filter"
        ariaLabel="Severity"
        label={renderLabel()}
        options={SEVERITY_DROPDOWN_OPTIONS}
        value={severity}
        onChange={onChangeSeverity}
        formatOptionLabel={formatOptionLabel}
        placeholder="Any severity"
        className={`${baseClass}__dropdown`}
        isDisabled={disabled}
        helpText={SEVERITY_HELP_TEXT}
      />
      {severity === CUSTOM_SEVERITY_VALUE && (
        <div className={`${baseClass}__cvss-range`}>
          <InputField
            label="Min score"
            onChange={onScoreChange}
            name="minScore"
            value={minScore}
            disabled={disabled}
            type="number"
            placeholder="0.0"
            min={0}
            max={10}
            step={0.1}
            parseTarget
            error={errors?.minScore}
          />
          <InputField
            label="Max score"
            onChange={onScoreChange}
            name="maxScore"
            value={maxScore}
            disabled={disabled}
            type="number"
            placeholder="10.0"
            min={0}
            max={10}
            step={0.1}
            parseTarget
            error={errors?.maxScore}
          />
        </div>
      )}
    </div>
  );
};

export default SeverityFilter;
