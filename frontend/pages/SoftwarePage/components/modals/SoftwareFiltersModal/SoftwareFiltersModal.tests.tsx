import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { renderWithSetup } from "test/test-utils";
import { noop } from "lodash";

import SoftwareFiltersModal from "./SoftwareFiltersModal";

const vulnFiltersDefault = {
  vulnerable: false,
  exploit: false,
  minCvssScore: undefined,
  maxCvssScore: undefined,
};

const renderModal = (props = {}) =>
  render(
    <SoftwareFiltersModal
      onExit={noop}
      onSubmit={noop}
      vulnFilters={vulnFiltersDefault}
      isPremiumTier
      {...props}
    />
  );

const setUpModal = (props = {}) =>
  renderWithSetup(
    <SoftwareFiltersModal
      onExit={noop}
      onSubmit={noop}
      vulnFilters={vulnFiltersDefault}
      isPremiumTier
      {...props}
    />
  );

// react-select renders its options as plain divs, so target them by the testid
// the shared custom Option component sets rather than by role.
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

describe("SoftwareFiltersModal component", () => {
  it("renders modal title and form fields", () => {
    renderModal();
    expect(screen.getByText(/Filters/i)).toBeInTheDocument();
    expect(screen.getByText(/Vulnerable software/i)).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Severity" })
    ).toBeInTheDocument();
    expect(screen.getByText(/Has known exploit/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Apply/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
  });

  it("hides the score inputs until Custom severity is selected", async () => {
    const { user } = setUpModal();
    await user.click(screen.getByRole("switch"));

    expect(screen.queryByLabelText(/Min score/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Max score/i)).not.toBeInTheDocument();

    await selectSeverity(user, "Custom severity");

    expect(screen.getByLabelText(/Min score/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Max score/i)).toBeInTheDocument();
  });

  it("disables input fields when Vulnerable software is off", () => {
    renderModal({
      vulnFilters: { ...vulnFiltersDefault, minCvssScore: 2 },
    });
    expect(screen.getByRole("combobox", { name: "Severity" })).toBeDisabled();
    expect(screen.getByLabelText(/Min score/i)).toBeDisabled();
    expect(screen.getByLabelText(/Max score/i)).toBeDisabled();
    const checkbox = screen.getByRole("checkbox", {
      name: /hasKnownExploit/i,
    });
    expect(checkbox).toHaveAttribute("aria-disabled", "true");
  });

  it("enables input fields when Vulnerable software is toggled on", async () => {
    const { user } = setUpModal({
      vulnFilters: { ...vulnFiltersDefault, minCvssScore: 2 },
    });
    await user.click(screen.getByRole("switch"));
    expect(screen.getByRole("combobox", { name: "Severity" })).toBeEnabled();
    expect(screen.getByLabelText(/Min score/i)).toBeEnabled();
    expect(screen.getByLabelText(/Max score/i)).toBeEnabled();
    const checkbox = screen.getByRole("checkbox", {
      name: /hasKnownExploit/i,
    });
    expect(checkbox).toHaveAttribute("aria-disabled", "false");
  });

  it("shows validation errors for non-numeric or out-of-range scores", async () => {
    const { user } = setUpModal();
    await user.click(screen.getByRole("switch"));
    await selectSeverity(user, "Custom severity");

    const minInput = screen.getByLabelText(/Min score/i);
    const maxInput = screen.getByLabelText(/Max score/i);

    // Out of range
    await user.type(minInput, "11");
    expect(screen.getByText(/Must be from 0-10/i)).toBeInTheDocument();

    await user.clear(minInput);
    await user.type(minInput, "-1");
    expect(screen.getByText(/Must be from 0-10/i)).toBeInTheDocument();

    await user.clear(minInput);
    await user.type(minInput, "5.55");
    expect(screen.getByText(/Must be from 0-10/i)).toBeInTheDocument();

    // Valid value, but min > max
    await user.clear(minInput);
    await user.type(minInput, "7");
    await user.clear(maxInput);
    await user.type(maxInput, "3");

    const applyButton = screen.getByRole("button", { name: /Apply/i });

    await user.hover(applyButton);
    await waitFor(() => {
      expect(
        screen.getByText(/Minimum CVSS score cannot be greater/i)
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Apply/i })).toBeDisabled();
  });

  it("calls onSubmit with the correct values when form is valid", async () => {
    const onSubmitSpy = jest.fn();
    const { user } = setUpModal({ onSubmit: onSubmitSpy });
    await user.click(screen.getByRole("switch"));
    await selectSeverity(user, "Custom severity");

    const minInput = screen.getByLabelText(/Min score/i);
    const maxInput = screen.getByLabelText(/Max score/i);

    await user.type(minInput, "3");
    await user.type(maxInput, "8.5");

    // Enable "Has known exploit"
    await user.click(screen.getByText(/Has known exploit/i));

    // Submit
    await user.click(screen.getByRole("button", { name: /Apply/i }));

    expect(onSubmitSpy).toHaveBeenCalledWith({
      vulnerable: true,
      exploit: true,
      minCvssScore: 3,
      maxCvssScore: 8.5,
    });
  });

  it("submits the bounds of the selected preset", async () => {
    const onSubmitSpy = jest.fn();
    const { user } = setUpModal({ onSubmit: onSubmitSpy });
    await user.click(screen.getByRole("switch"));
    await selectSeverity(user, "High severity");

    await user.click(screen.getByRole("button", { name: /Apply/i }));

    expect(onSubmitSpy).toHaveBeenCalledWith({
      vulnerable: true,
      exploit: undefined,
      minCvssScore: 7,
      maxCvssScore: 8.9,
    });
  });

  it("submits no CVSS bounds for Any severity", async () => {
    const onSubmitSpy = jest.fn();
    const { user } = setUpModal({
      onSubmit: onSubmitSpy,
      vulnFilters: {
        ...vulnFiltersDefault,
        minCvssScore: 7,
        maxCvssScore: 8.9,
      },
    });
    await user.click(screen.getByRole("switch"));
    await selectSeverity(user, "Any severity");

    await user.click(screen.getByRole("button", { name: /Apply/i }));

    expect(onSubmitSpy).toHaveBeenCalledWith({
      vulnerable: true,
      exploit: undefined,
      minCvssScore: undefined,
      maxCvssScore: undefined,
    });
  });

  it("keeps the dropdown on Custom while scores are typed, and submits what it shows", async () => {
    const onSubmitSpy = jest.fn();
    const { user } = setUpModal({ onSubmit: onSubmitSpy });
    await user.click(screen.getByRole("switch"));
    await selectSeverity(user, "Custom severity");

    // A lone "0" in Min used to derive (0, 10) and collapse the control to
    // "Any severity" while still submitting min_cvss_score=0.
    await user.type(screen.getByLabelText(/Min score/i), "0");

    // The closed control keeps naming Custom, now with the range it will send.
    expect(screen.getByText("Custom (0 to 10)")).toBeInTheDocument();
    expect(screen.queryByText(/^Any\b/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Min score/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Apply/i }));

    expect(onSubmitSpy).toHaveBeenCalledWith({
      vulnerable: true,
      exploit: undefined,
      minCvssScore: 0,
      maxCvssScore: undefined,
    });
  });

  it("hides the severity filter on Fleet Free", () => {
    renderModal({ isPremiumTier: false });

    expect(
      screen.queryByRole("combobox", { name: "Severity" })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Min score/i)).not.toBeInTheDocument();
  });
});
