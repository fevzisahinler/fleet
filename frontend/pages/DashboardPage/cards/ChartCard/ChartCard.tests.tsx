/* eslint-disable @typescript-eslint/no-empty-function, class-methods-use-this */
import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { createCustomRenderer, baseUrl } from "test/test-utils";
import mockServer from "test/mock-server";
import { ALL_CVE_SOFTWARE_CATEGORY_VALUES } from "interfaces/charts";
import { SeverityValue } from "components/SeverityFilter/helpers";

import ChartCard, {
  buildInitialChartFilters,
  hostFilterLines,
  softwareFilterLines,
} from "./ChartCard";

// Mock ResizeObserver for CheckerboardViz
const MOCK_WIDTH = 600;

class MockResizeObserver {
  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.callback(
      [
        {
          target,
          contentRect: { width: MOCK_WIDTH, height: 400 } as DOMRectReadOnly,
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        },
      ],
      this
    );
  }

  // eslint-disable-next-line class-methods-use-this
  unobserve() {}

  // eslint-disable-next-line class-methods-use-this
  disconnect() {}
}

const generateMockChartResponse = (metric: string, days: number) => {
  const data = [];
  for (let d = 0; d < days; d += 1) {
    const dateStr = `2026-03-${String(d + 1).padStart(2, "0")}`;
    for (let h = 0; h < 24; h += 2) {
      data.push({
        timestamp: `${dateStr}T${String(h).padStart(2, "0")}:00:00`,
        value: Math.floor(Math.random() * 100),
      });
    }
  }
  return {
    metric,
    visualization: metric === "uptime" ? "checkerboard" : "line",
    total_hosts: 100,
    resolution: "2h",
    days,
    filters: {},
    data,
  };
};

const chartHandler = http.get(baseUrl("/charts/:metric"), ({ params }) => {
  const metric = params.metric as string;
  return HttpResponse.json(generateMockChartResponse(metric, 30));
});

const emptyChartHandler = http.get(baseUrl("/charts/:metric"), () => {
  return HttpResponse.json({
    metric: "uptime",
    visualization: "checkerboard",
    total_hosts: 0,
    resolution: "2h",
    days: 30,
    filters: {},
    data: [],
  });
});

describe("ChartCard", () => {
  const origGetBCR = Element.prototype.getBoundingClientRect;
  const origResizeObserver = global.ResizeObserver;

  beforeAll(() => {
    global.ResizeObserver = (MockResizeObserver as unknown) as typeof ResizeObserver;
    Element.prototype.getBoundingClientRect = function mockBCR() {
      return {
        width: MOCK_WIDTH,
        height: 400,
        top: 0,
        left: 0,
        bottom: 400,
        right: MOCK_WIDTH,
        x: 0,
        y: 0,
        toJSON: () => {},
      };
    };
  });

  afterAll(() => {
    Element.prototype.getBoundingClientRect = origGetBCR;
    global.ResizeObserver = origResizeObserver;
  });

  it("renders the checkerboard visualization for uptime (default)", async () => {
    mockServer.use(chartHandler);
    const render = createCustomRenderer({ withBackendMock: true });
    const { container } = render(<ChartCard />);

    // Wait for data to load — checkerboard cells should appear
    await waitFor(() => {
      const rects = container.querySelectorAll("rect");
      expect(rects.length).toBeGreaterThan(0);
    });

    // Legend should be visible
    expect(screen.getByText("No data")).toBeInTheDocument();
    expect(screen.getByText("Less")).toBeInTheDocument();
    expect(screen.getByText("More")).toBeInTheDocument();
  });

  it("shows the no-data message when API returns empty data", async () => {
    mockServer.use(emptyChartHandler);
    const render = createCustomRenderer({ withBackendMock: true });
    render(<ChartCard />);

    await screen.findByText("No chart data available yet.");
  });

  it("renders the current dataset heading", async () => {
    mockServer.use(chartHandler);
    const render = createCustomRenderer({ withBackendMock: true });
    render(<ChartCard />);

    // Only one dataset is wired up today, so it renders as a heading rather
    // than a dropdown. Days selection is fixed at 30 and has no UI yet.
    await waitFor(() => {
      expect(screen.getByText("Hosts online")).toBeInTheDocument();
    });
  });

  it("renders the empty state with a Turn on button for admins", () => {
    const render = createCustomRenderer({
      withBackendMock: true,
      context: { app: { isGlobalAdmin: true } },
    });
    render(
      <ChartCard
        historicalDataEnabled={{ uptime: false, vulnerabilities: true }}
      />
    );

    expect(
      screen.getByText(/Data collection is disabled/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Turn on/i })
    ).toBeInTheDocument();
  });

  it("hides the Turn on button and swaps copy for non-admins", () => {
    const render = createCustomRenderer({
      withBackendMock: true,
      context: { app: { isGlobalAdmin: false, isTeamAdmin: false } },
    });
    render(
      <ChartCard
        historicalDataEnabled={{ uptime: false, vulnerabilities: true }}
      />
    );

    expect(
      screen.getByText(/Data collection is disabled/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Ask an admin to turn on/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Turn on/i })
    ).not.toBeInTheDocument();
  });

  it("renders the chart normally when collection is enabled", async () => {
    mockServer.use(chartHandler);
    const render = createCustomRenderer({ withBackendMock: true });
    const { container } = render(
      <ChartCard
        historicalDataEnabled={{ uptime: true, vulnerabilities: true }}
      />
    );

    await waitFor(() => {
      const rects = container.querySelectorAll("rect");
      expect(rects.length).toBeGreaterThan(0);
    });
    expect(
      screen.queryByText(/Data collection is disabled/i)
    ).not.toBeInTheDocument();
  });

  it("includes mobile platforms by default and does not show the Filtered badge", async () => {
    let requestedPlatforms: string | null = null;
    mockServer.use(
      http.get(baseUrl("/charts/:metric"), ({ params, request }) => {
        requestedPlatforms = new URL(request.url).searchParams.get("platforms");
        return HttpResponse.json(
          generateMockChartResponse(params.metric as string, 30)
        );
      })
    );
    const render = createCustomRenderer({ withBackendMock: true });
    render(<ChartCard />);

    // No platform filter is active by default, so all platforms (including
    // iOS/iPadOS/Android) are included and the "Filtered" badge is absent.
    await waitFor(() => {
      const rects = document.querySelectorAll("rect");
      expect(rects.length).toBeGreaterThan(0);
    });
    expect(requestedPlatforms).toBeNull();
    expect(screen.queryByText("Filtered")).not.toBeInTheDocument();
  });

  describe("vulnerability exposure severity filter", () => {
    // Captures the query params of the last /charts/cve request.
    const useCveHandler = () => {
      const captured: { params: URLSearchParams | null } = { params: null };
      mockServer.use(
        http.get(baseUrl("/charts/:metric"), ({ params, request }) => {
          if (params.metric === "cve") {
            captured.params = new URL(request.url).searchParams;
          }
          return HttpResponse.json(
            generateMockChartResponse(params.metric as string, 30)
          );
        })
      );
      return captured;
    };

    const renderPremium = (
      props: React.ComponentProps<typeof ChartCard> = {}
    ) =>
      createCustomRenderer({
        withBackendMock: true,
        context: { app: { isPremiumTier: true } },
      })(<ChartCard {...props} />);

    // react-select renders its options as plain divs, so target them by the
    // testid the shared custom Option component sets rather than by role.
    const selectDataset = async (
      user: ReturnType<typeof renderPremium>["user"],
      label: string
    ) => {
      // Let the initial chart request settle first — the re-render it triggers
      // closes the menu again if it lands between opening and picking.
      await waitFor(() => {
        expect(document.querySelectorAll("rect").length).toBeGreaterThan(0);
      });
      await user.click(screen.getByRole("combobox", { name: "dataset" }));
      const option = screen
        .getAllByTestId("dropdown-option")
        .find((el) => el.textContent?.startsWith(label));
      if (!option) {
        throw new Error(`No dataset option matching "${label}"`);
      }
      await user.click(option);
    };

    it("defaults to critical severity and lights the Filtered pill", async () => {
      const captured = useCveHandler();
      const { user } = renderPremium();

      await selectDataset(user, "Vulnerability exposure");

      await waitFor(() => expect(captured.params).not.toBeNull());
      expect(captured.params?.get("severity_min")).toBe("9");
      expect(captured.params?.get("severity_max")).toBe("10");

      // The pill's tooltip text is covered by the softwareFilterLines tests
      // below — react-tooltip does not mount its content in jsdom, so there is
      // nothing to assert against here beyond the pill itself.
      expect(screen.getByText("Filtered")).toBeInTheDocument();
    });

    it("sends the raw bounds of a custom range, including a 0 minimum", async () => {
      const captured = useCveHandler();
      const { user } = renderPremium({
        filterDefaults: { cvss_min: 0, cvss_max: 6.5 },
      });

      await selectDataset(user, "Vulnerability exposure");

      await waitFor(() => expect(captured.params).not.toBeNull());
      // 0 is a real bound, not an empty value to be dropped from the query.
      expect(captured.params?.get("severity_min")).toBe("0");
      expect(captured.params?.get("severity_max")).toBe("6.5");
    });

    it("sends no severity bounds for Any severity", async () => {
      const captured = useCveHandler();
      const { user } = renderPremium({
        filterDefaults: { cvss_min: 0, cvss_max: 10 },
      });

      await selectDataset(user, "Vulnerability exposure");

      await waitFor(() => expect(captured.params).not.toBeNull());
      expect(captured.params?.get("severity_min")).toBeNull();
      expect(captured.params?.get("severity_max")).toBeNull();

      expect(screen.queryByText("Filtered")).not.toBeInTheDocument();
    });

    it("no longer advertises the severity filter as coming soon", async () => {
      useCveHandler();
      const { user } = renderPremium();

      await selectDataset(user, "Vulnerability exposure");

      expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
      expect(
        screen.queryByText(/All critical vulnerabilities/i)
      ).not.toBeInTheDocument();
    });
  });
});

describe("buildInitialChartFilters", () => {
  it("uses built-in defaults when no persisted defaults are provided", () => {
    const filters = buildInitialChartFilters(undefined);
    expect(filters.softwareFilters).toEqual([
      ...ALL_CVE_SOFTWARE_CATEGORY_VALUES,
    ]);
    expect(filters.knownExploit).toBe(false);
    expect(filters.epssMin).toBe("");
    expect(filters.epssMax).toBe("");
    expect(filters.severity).toBe("critical");
    expect(filters.cvssMin).toBe("");
    expect(filters.cvssMax).toBe("");
    expect(filters.excludeCVEs).toEqual([]);
  });

  it("keeps the critical severity default when no CVSS bounds are persisted", () => {
    const filters = buildInitialChartFilters({ has_known_exploit: true });
    expect(filters.severity).toBe("critical");
    expect(filters.cvssMin).toBe("");
    expect(filters.cvssMax).toBe("");
  });

  it("seeds a preset when the persisted CVSS bounds match one", () => {
    expect(
      buildInitialChartFilters({ cvss_min: 7, cvss_max: 8.9 })
    ).toMatchObject({ severity: "high", cvssMin: "", cvssMax: "" });
    expect(
      buildInitialChartFilters({ cvss_min: 0, cvss_max: 10 })
    ).toMatchObject({ severity: "any", cvssMin: "", cvssMax: "" });
  });

  it("seeds a custom range when only one CVSS bound is persisted", () => {
    expect(buildInitialChartFilters({ cvss_min: 7 })).toMatchObject({
      severity: "custom",
      cvssMin: "7",
      cvssMax: "10",
    });
  });

  it("seeds present fields and falls back per-field for absent ones", () => {
    const filters = buildInitialChartFilters({
      software_filters: ["browsers"],
      has_known_exploit: true,
    });
    expect(filters.softwareFilters).toEqual(["browsers"]);
    expect(filters.knownExploit).toBe(true);
    expect(filters.epssMin).toBe("");
    expect(filters.epssMax).toBe("");
    expect(filters.excludeCVEs).toEqual([]);
  });

  it("converts numeric EPSS bounds (0-100) to strings", () => {
    const filters = buildInitialChartFilters({ epss_min: 0, epss_max: 90 });
    expect(filters.epssMin).toBe("0");
    expect(filters.epssMax).toBe("90");
  });

  it("honors an explicit empty software_filters list as 'none'", () => {
    const filters = buildInitialChartFilters({ software_filters: [] });
    expect(filters.softwareFilters).toEqual([]);
  });

  it("seeds the exclude-CVE list", () => {
    const filters = buildInitialChartFilters({
      exclude_vulnerabilities: ["CVE-2025-50897"],
    });
    expect(filters.excludeCVEs).toEqual(["CVE-2025-50897"]);
  });
});

describe("softwareFilterLines", () => {
  const filtersWithSeverity = (
    severity: SeverityValue,
    cvssMin = "",
    cvssMax = ""
  ) => ({
    ...buildInitialChartFilters(undefined),
    severity,
    cvssMin,
    cvssMax,
  });

  it("names the active severity and its CVSS range on its own line", () => {
    expect(softwareFilterLines(filtersWithSeverity("critical"))).toEqual([
      "Severity: Critical (9.0 to 10)",
    ]);
    expect(softwareFilterLines(filtersWithSeverity("low"))).toEqual([
      "Severity: Low (0.1 to 3.9)",
    ]);
  });

  it("spells out the range behind a Custom selection", () => {
    // "Severity: Custom" alone would not tell the reader what is filtered.
    expect(
      softwareFilterLines(filtersWithSeverity("custom", "2.5", "6"))
    ).toEqual(["Severity: Custom (2.5 to 6)"]);
    // A half-open range names the bound it widens to, matching what is sent.
    expect(
      softwareFilterLines(filtersWithSeverity("custom", "2.5", ""))
    ).toEqual(["Severity: Custom (2.5 to 10)"]);
  });

  it("omits the severity line for Any severity", () => {
    expect(softwareFilterLines(filtersWithSeverity("any"))).toEqual([]);
  });

  it("omits the severity line for a Custom range with no bounds entered", () => {
    // Nothing is sent to the API in this state, so claiming a severity filter
    // would describe the chart as narrower than it is.
    expect(softwareFilterLines(filtersWithSeverity("custom"))).toEqual([]);
    // A single bound is enough to be a real filter.
    expect(
      softwareFilterLines(filtersWithSeverity("custom", "", "6"))
    ).toEqual(["Severity: Custom (0 to 6)"]);
  });

  it("keeps severity separate from the generic Advanced filters line", () => {
    expect(
      softwareFilterLines({
        ...filtersWithSeverity("high"),
        excludeCVEs: ["CVE-2025-0001"],
      })
    ).toEqual(["Severity: High (7.0 to 8.9)", "Advanced filters"]);
  });
});

describe("hostFilterLines", () => {
  const filtersWithPlatforms = (platforms: string[]) => ({
    ...buildInitialChartFilters(undefined),
    platforms,
  });

  it("preserves branded platform casing (macOS, iOS, iPadOS)", () => {
    const [line] = hostFilterLines(
      filtersWithPlatforms(["darwin", "ios", "ipados"])
    );
    expect(line).toBe("macOS, iOS, and iPadOS");
    // Guards the reported bug: no word-capitalized variants.
    expect(line).not.toMatch(/MacOS|Ios|Ipados/);
  });

  it("renders a single platform without mangling its casing", () => {
    expect(hostFilterLines(filtersWithPlatforms(["darwin"]))).toEqual([
      "macOS",
    ]);
  });

  it("maps every filterable platform to its correct display name", () => {
    const [line] = hostFilterLines(
      filtersWithPlatforms([
        "darwin",
        "windows",
        "linux",
        "chrome",
        "ios",
        "ipados",
        "android",
      ])
    );
    expect(line).toBe(
      "macOS, Windows, Linux, ChromeOS, iOS, iPadOS, and Android"
    );
  });
});
