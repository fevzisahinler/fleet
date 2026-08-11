import React, { useState } from "react";

import Modal from "components/Modal";
import Button from "components/buttons/Button";
import Slider from "components/forms/fields/Slider";
import Checkbox from "components/forms/fields/Checkbox";
import TooltipWrapper from "components/TooltipWrapper";
import SeverityFilter, {
  ISeverityFilterValue,
} from "components/SeverityFilter";
import {
  findOptionBySeverityRange,
  SeverityValue,
  validateSeverityScores,
} from "components/SeverityFilter/helpers";
import { ISoftwareVulnFiltersParams } from "pages/SoftwarePage/SoftwareInventory/SoftwareInventoryTable/helpers";

const baseClass = "software-filters-modal";

interface ISoftwareFiltersModalProps {
  onExit: () => void;
  onSubmit: (vulnFilters: ISoftwareVulnFiltersParams) => void;
  vulnFilters: ISoftwareVulnFiltersParams;
  isPremiumTier: boolean;
}

type IFormData = {
  minScore: string;
  maxScore: string;
};

type IFormErrors = {
  minScore?: string;
  maxScore?: string;
  disableApplyButton?: React.ReactNode;
};

const validate = (data: IFormData): IFormErrors => {
  const { minScore, maxScore, rangeInvalid } = validateSeverityScores(data);

  return {
    ...(minScore && { minScore }),
    ...(maxScore && { maxScore }),
    ...(rangeInvalid && {
      disableApplyButton: (
        <>
          Minimum CVSS score cannot be greater
          <br /> than the maximum CVSS score.
        </>
      ),
    }),
  };
};

const SoftwareFiltersModal = ({
  onExit,
  onSubmit,
  vulnFilters,
  isPremiumTier,
}: ISoftwareFiltersModalProps) => {
  const [vulnSoftwareFilterEnabled, setVulnSoftwareFilterEnabled] = useState(
    vulnFilters.vulnerable || false
  );
  const [severity, setSeverity] = useState<SeverityValue>(
    findOptionBySeverityRange(
      vulnFilters.minCvssScore,
      vulnFilters.maxCvssScore
    ).value
  );
  // Unified form state:
  const [formData, setFormData] = useState<IFormData>({
    minScore: vulnFilters.minCvssScore?.toString() ?? "",
    maxScore: vulnFilters.maxCvssScore?.toString() ?? "",
  });
  const [hasKnownExploit, setHasKnownExploit] = useState(vulnFilters.exploit);
  const [formErrors, setFormErrors] = useState<IFormErrors>({});

  const onChangeSeverity = ({
    severity: nextSeverity,
    minScore,
    maxScore,
  }: ISeverityFilterValue) => {
    const newFormData = { minScore, maxScore };
    setSeverity(nextSeverity);
    setFormData(newFormData);
    // InputField only allows numbers
    // Only errors if number outside range or multiple decimals
    setFormErrors(validate(newFormData));
  };

  const handleSubmit = (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    const errors = validate(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    const min = formData.minScore ? parseFloat(formData.minScore) : undefined;
    const max = formData.maxScore ? parseFloat(formData.maxScore) : undefined;

    onSubmit({
      vulnerable: vulnSoftwareFilterEnabled,
      exploit: hasKnownExploit || undefined,
      minCvssScore: min === 0 && max === 10 ? undefined : min, // Only clear severity if set to 0-10
      maxCvssScore: min === 0 && max === 10 ? undefined : max, // Only clear severity if set to 0-10
    });
  };

  const renderModalContent = () => {
    return (
      <form onSubmit={handleSubmit}>
        <Slider
          value={vulnSoftwareFilterEnabled}
          onChange={() =>
            setVulnSoftwareFilterEnabled(!vulnSoftwareFilterEnabled)
          }
          inactiveText="Vulnerable software"
          activeText="Vulnerable software"
        />
        {isPremiumTier && (
          <>
            <SeverityFilter
              severity={severity}
              minScore={formData.minScore}
              maxScore={formData.maxScore}
              onChange={onChangeSeverity}
              disabled={!vulnSoftwareFilterEnabled}
              errors={{
                minScore: formErrors.minScore,
                maxScore: formErrors.maxScore,
              }}
            />
            <Checkbox
              onChange={({ value }: { value: boolean }) =>
                setHasKnownExploit(value)
              }
              name="hasKnownExploit"
              value={hasKnownExploit}
              parseTarget
              helpText="Software has vulnerabilities that have been actively exploited in the wild."
              disabled={!vulnSoftwareFilterEnabled}
            >
              Has known exploit
            </Checkbox>
          </>
        )}
        <div className="modal-cta-wrap">
          <TooltipWrapper
            tipContent={formErrors.disableApplyButton}
            disableTooltip={!formErrors.disableApplyButton}
            showArrow
            position="top"
            tipOffset={8}
            underline={false}
          >
            <Button
              type="submit"
              disabled={
                !!formErrors.disableApplyButton ||
                !!formErrors.minScore ||
                !!formErrors.maxScore
              }
            >
              Apply
            </Button>
          </TooltipWrapper>
          <Button variant="secondary" onClick={onExit}>
            Cancel
          </Button>
        </div>
      </form>
    );
  };

  return (
    <Modal title="Filters" onExit={onExit} className={baseClass}>
      {renderModalContent()}
    </Modal>
  );
};

export default SoftwareFiltersModal;
