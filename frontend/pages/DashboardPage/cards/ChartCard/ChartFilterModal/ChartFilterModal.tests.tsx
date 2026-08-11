import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { noop } from "lodash";

import { createCustomRenderer, baseUrl } from "test/test-utils";
import mockServer from "test/mock-server";
import { ALL_CVE_SOFTWARE_CATEGORY_VALUES } from "interfaces/charts";

import ChartFilterModal, {
  IChartFilterState,
  PLATFORM_OPTIONS,
} from "./ChartFilterModal";

describe("ChartFilterModal PLATFORM_OPTIONS", () => {
  it("offers mobile platforms (iOS, iPadOS, Android) alongside desktop", () => {
    const values = PLATFORM_OPTIONS.map((o) => o.value);
    expect(values).toEqual([
      "darwin",
      "windows",
      "linux",
      "chrome",
      "ios",
      "ipados",
      "android",
    ]);
  });

  it("labels the mobile platforms for display", () => {
    const labelFor = (value: string) =>
      PLATFORM_OPTIONS.find((o) => o.value === value)?.label;
    expect(labelFor("ios")).toBe("iOS");
    expect(labelFor("ipados")).toBe("iPadOS");
    expect(labelFor("android")).toBe("Android");
  });
});

describe("ChartFilterModal severity", () => {
  const baseFilters: IChartFilterState = {
    labelIDs: [],
    platforms: [],
    hostFilterMode: "none",
    selectedHosts: [],
    softwareFilters: [...ALL_CVE_SOFTWARE_CATEGORY_VALUES],
    knownExploit: false,
    epssMin: "",
    epssMax: "",
    severity: "critical",
    cvssMin: "",
    cvssMax: "",
    excludeCVEs: [],
  };

  beforeEach(() => {
    mockServer.use(
      http.get(baseUrl("/hosts"), () =>
        HttpResponse.json({ hosts: [], software: null })
      ),
      http.get(baseUrl("/labels/summary"), () =>
        HttpResponse.json({ labels: [] })
      ),
      http.get(baseUrl("/vulnerabilities"), () =>
        HttpResponse.json({
          count: 0,
          counts_updated_at: "",
          vulnerabilities: [],
          meta: { has_next_results: false, has_previous_results: false },
        })
      )
    );
  });

  const renderModal = (
    props: Partial<React.ComponentProps<typeof ChartFilterModal>> = {}
  ) =>
    createCustomRenderer({ withBackendMock: true })(
      <ChartFilterModal
        filters={baseFilters}
        metric="cve"
        initialTab="software"
        onApply={noop}
        onCancel={noop}
        {...props}
      />
    );

  it("applies the current severity selection", async () => {
    const onApply = jest.fn();
    const { user } = renderModal({ onApply });

    await user.click(screen.getByRole("button", { name: /Apply/i }));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: "critical",
        cvssMin: "",
        cvssMax: "",
      })
    );
  });

  it("resets severity to Any on Clear all and hides the button", async () => {
    const { user } = renderModal();

    // The Critical default is an active filter, so Clear all is offered.
    const clearAll = screen.getByRole("button", { name: /Clear all/i });
    await user.click(clearAll);

    // The severity control lives behind the Advanced options reveal.
    await user.click(screen.getByRole("button", { name: /Advanced options/i }));
    expect(screen.getByText("Any severity")).toBeInTheDocument();

    // Nothing is filtered anymore, so there is nothing left to clear.
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /Clear all/i })
      ).not.toBeInTheDocument();
    });
  });

  it("offers no Clear all for a Custom range with no bounds entered", () => {
    renderModal({
      filters: { ...baseFilters, severity: "custom", cvssMin: "", cvssMax: "" },
    });

    // Custom without bounds sends nothing to the API, so it must not count as
    // an active filter — otherwise Clear all would appear over unfiltered data.
    expect(
      screen.queryByRole("button", { name: /Clear all/i })
    ).not.toBeInTheDocument();
  });

  it("clears to Any severity, which applies with no bounds", async () => {
    const onApply = jest.fn();
    const { user } = renderModal({ onApply });

    await user.click(screen.getByRole("button", { name: /Clear all/i }));
    await user.click(screen.getByRole("button", { name: /Apply/i }));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "any", cvssMin: "", cvssMax: "" })
    );
  });

  it("blocks Apply on an invalid custom CVSS range", () => {
    renderModal({
      filters: {
        ...baseFilters,
        severity: "custom",
        cvssMin: "9",
        cvssMax: "3",
      },
    });

    expect(screen.getByRole("button", { name: /Apply/i })).toBeDisabled();
  });
});
