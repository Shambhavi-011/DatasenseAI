import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { askDataset } from "../services/askService";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const CHART_COLORS = ["#06B6D4", "#7C3AED", "#8B5CF6", "#22D3EE", "#A78BFA"];

function DatasetDashboardPage() {
  const { datasetId } = useParams();

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [askResult, setAskResult] = useState(null);
  const [askLoading, setAskLoading] = useState(false);
  const [dataset, setDataset] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [columnNames, setColumnNames] = useState([]);
  const [summary, setSummary] = useState(null);
  const [charts, setCharts] = useState({});
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [previewRes, summaryRes, chartRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/datasets/${datasetId}/preview`),
          fetch(`${API_BASE_URL}/api/datasets/${datasetId}/dynamic-summary`),
          fetch(`${API_BASE_URL}/api/datasets/${datasetId}/dynamic-charts`),
        ]);

        const previewData = await previewRes.json();
        const summaryData = await summaryRes.json();
        const chartData = await chartRes.json();

        if (!previewRes.ok)
          throw new Error(previewData.detail || "Preview failed");

        if (!summaryRes.ok)
          throw new Error(summaryData.detail || "Summary failed");

        if (!chartRes.ok)
          throw new Error(chartData.detail || "Charts failed");

        setDataset(previewData.dataset);
        setPreviewRows(previewData.preview_rows || []);
        setColumnNames(previewData.column_names || []);
        setSummary(summaryData);
        setCharts(chartData);
      } catch (err) {
        setPageError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (datasetId) fetchData();
  }, [datasetId]);

  const overviewCards = useMemo(() => {
    if (!summary?.overview) return [];

    return [
      { title: "Rows", value: summary.overview.rows, icon: "↕" },
      { title: "Columns", value: summary.overview.columns, icon: "▦" },
      {
        title: "Numeric Columns",
        value: summary.overview.numeric_columns,
        icon: "∑",
      },
      {
        title: "Categorical Columns",
        value: summary.overview.categorical_columns,
        icon: "Aa",
      },
      {
        title: "Missing Values",
        value: summary.overview.missing_values,
        icon: "◌",
      },
      {
        title: "Duplicate Rows",
        value: summary.overview.duplicate_rows,
        icon: "⧉",
      },
    ];
  }, [summary]);

  const insights = useMemo(() => {
    const overview = summary?.overview;
    if (!overview) return [];

    const items = [];

    items.push(
      `${Number(overview.rows || 0).toLocaleString()} rows across ${Number(
        overview.columns || 0
      ).toLocaleString()} columns.`
    );

    if (Number(overview.numeric_columns || 0) > 0) {
      items.push(
        `${overview.numeric_columns} numeric column${
          overview.numeric_columns === 1 ? "" : "s"
        } available for quantitative analysis.`
      );
    }

    if (Number(overview.missing_values || 0) > 0) {
      items.push(
        `${Number(overview.missing_values).toLocaleString()} missing value${
          overview.missing_values === 1 ? "" : "s"
        } detected in the dataset.`
      );
    } else {
      items.push("No missing values were detected in the available dataset.");
    }

    if (Number(overview.duplicate_rows || 0) > 0) {
      items.push(
        `${Number(overview.duplicate_rows).toLocaleString()} duplicate row${
          overview.duplicate_rows === 1 ? "" : "s"
        } detected.`
      );
    } else {
      items.push("No duplicate rows were detected.");
    }

    return items.slice(0, 4);
  }, [summary]);

  const ask = async () => {
    if (!question.trim() || askLoading) return;

    try {
      setAskLoading(true);
      setAnswer("");
      setAskResult(null);

      const result = await askDataset(datasetId, question);

      setAskResult(result);

      setAnswer(
        result.ai?.plain_language_answer ||
          (result.result?.rows?.[0]
            ? Object.entries(result.result.rows[0])
                .map(([key, value]) => `${key}: ${value}`)
                .join(" • ")
            : "No result available.")
      );
    } catch (err) {
      setAnswer("Something went wrong while processing your question.");
      setAskResult(null);
    } finally {
      setAskLoading(false);
    }
  };

  const renderAskChart = () => {
    const rows = askResult?.result?.rows || [];
    const columns = askResult?.result?.columns || [];
    const chartType = String(askResult?.ai?.chart_type || "").toLowerCase();

    if (
      rows.length === 0 ||
      columns.length < 2 ||
      !chartType ||
      chartType === "none"
    ) {
      return null;
    }

    if (chartType === "line") {
      return (
        <LineChart data={rows}>
          <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
          <XAxis dataKey={columns[0]} stroke="#64748B" />
          <YAxis stroke="#64748B" />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#CBD5E1" }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey={columns[1]}
            stroke="#06B6D4"
            strokeWidth={3}
            dot={false}
          />
        </LineChart>
      );
    }

    if (chartType === "pie") {
      return (
        <PieChart>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Pie
            data={rows}
            dataKey={columns[1]}
            nameKey={columns[0]}
            cx="50%"
            cy="50%"
            outerRadius={105}
            innerRadius={45}
            paddingAngle={3}
          >
            {rows.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Pie>
        </PieChart>
      );
    }

    return (
      <BarChart data={rows}>
        <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
        <XAxis dataKey={columns[0]} stroke="#64748B" />
        <YAxis stroke="#64748B" />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: "#CBD5E1" }}
        />
        <Legend />
        <Bar
          dataKey={columns[1]}
          fill="#7C3AED"
          radius={[6, 6, 0, 0]}
        />
      </BarChart>
    );
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={loadingCardStyle}>
          <div style={aiDotStyle} />
          <h2 style={{ margin: 0 }}>Loading DataSense AI...</h2>
          <p style={mutedTextStyle}>Preparing your analytics workspace.</p>
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div style={pageStyle}>
        <div style={errorCardStyle}>
          <div style={errorIconStyle}>!</div>
          <h2 style={{ margin: "0 0 8px" }}>Unable to load dashboard</h2>
          <p style={{ color: "#94A3B8" }}>{pageError}</p>
          <Link to="/" style={primaryLinkStyle}>
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{globalStyles}</style>

      <div style={appShellStyle}>
        {/* SIDEBAR */}
        <aside className="sidebar" style={sidebarStyle}>
          <div>
            <Link to="/" style={brandStyle}>
              <span style={brandMarkStyle}>✦</span>
              <span>
                DataSense<span style={{ color: "#06B6D4" }}>AI</span>
              </span>
            </Link>

            <Link to="/" style={uploadButtonStyle}>
              <span style={uploadIconStyle}>＋</span>
              <span>New Upload</span>
            </Link>

            <nav style={navStyle}>
              <div style={navLabelStyle}>WORKSPACE</div>

              <Link to="/" style={{ ...navItemStyle, ...activeNavItemStyle }}>
                <span>▦</span>
                <span>Datasets</span>
              </Link>

              <div style={navItemStyle}>
                <span>◈</span>
                <span>Workspaces</span>
              </div>

              <div style={navItemStyle}>
                <span>⚙</span>
                <span>Settings</span>
              </div>
            </nav>
          </div>

          <div style={sidebarBottomStyle}>
            <div style={statusDotStyle} />
            <div>
              <div style={{ fontSize: 12, color: "#CBD5E1" }}>
                AI Engine Online
              </div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>
                Secure workspace
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="main-content" style={mainStyle}>
          <header className="topbar" style={topbarStyle}>
            <div>
              <div style={eyebrowStyle}>DATA WORKSPACE / DATASET {datasetId}</div>
              <h1 style={pageTitleStyle}>
                {dataset?.file_name || "Dataset Dashboard"}
              </h1>
              <p style={pageSubtitleStyle}>
                Explore, understand and query your data with AI.
              </p>
            </div>

            <Link to="/" style={secondaryButtonStyle}>
              Upload Dataset
            </Link>
          </header>

          {/* AI SEARCH */}
          <section style={askHeroStyle}>
            <div style={askHeroGlowStyle} />

            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={aiBadgeStyle}>
                <span style={pulseStyle}>✦</span>
                AI DATA ASSISTANT
              </div>

              <h2 style={askTitleStyle}>Ask anything about your data.</h2>

              <p style={askSubtitleStyle}>
                Use natural language to discover patterns, trends and answers.
              </p>

              <div className="search-row" style={searchRowStyle}>
                <div style={searchInputWrapStyle}>
                  <span style={searchIconStyle}>⌕</span>
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") ask();
                    }}
                    placeholder="Ask anything about your data... e.g. Show me revenue trends by region"
                    style={searchInputStyle}
                  />
                </div>

                <button
                  className="ask-button"
                  onClick={ask}
                  disabled={askLoading || !question.trim()}
                  style={{
                    ...askButtonStyle,
                    opacity: askLoading || !question.trim() ? 0.55 : 1,
                  }}
                >
                  {askLoading ? "Thinking..." : "Ask AI  →"}
                </button>
              </div>

              <div style={suggestionsStyle}>
                {[
                  "Summarize this dataset",
                  "Show important trends",
                  "Which column has the highest values?",
                  "Are there any missing values?",
                  "Show distribution of numeric columns",
                ].map((item) => (
                  <button
                    key={item}
                    onClick={() => setQuestion(item)}
                    style={suggestionStyle}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* OVERVIEW */}
          <section style={sectionStyle}>
            <SectionHeading
              eyebrow="AT A GLANCE"
              title="Dataset Overview"
              subtitle="A quick view of the structure and quality of your data."
            />

            <div className="kpi-grid" style={kpiGridStyle}>
              {overviewCards.map((card, index) => (
                <div key={card.title} style={kpiCardStyle}>
                  <div style={kpiTopRowStyle}>
                    <span style={kpiIconStyle}>{card.icon}</span>
                    <span style={kpiIndexStyle}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div style={kpiValueStyle}>
                    {Number(card.value ?? 0).toLocaleString()}
                  </div>
                  <div style={kpiLabelStyle}>{card.title}</div>
                </div>
              ))}
            </div>
          </section>

          {/* CHARTS */}
          <section style={sectionStyle}>
            <SectionHeading
              eyebrow="VISUAL ANALYTICS"
              title="Data Signals"
              subtitle="Automatically generated visualizations from your dataset."
            />

            <div className="chart-grid" style={chartGridStyle}>
              <div style={analyticsCardStyle}>
                <div style={cardHeaderStyle}>
                  <div>
                    <div style={cardEyebrowStyle}>PRIMARY ANALYSIS</div>
                    <h3 style={cardTitleStyle}>Dynamic Bar Chart</h3>
                  </div>
                  <span style={cyanBadgeStyle}>LIVE DATA</span>
                </div>

                {charts?.bar_chart ? (
                  <div style={chartAreaStyle}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={charts.bar_chart.data}>
                        <CartesianGrid
                          stroke="#1E293B"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey={charts.bar_chart.x}
                          stroke="#64748B"
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                        />
                        <YAxis
                          stroke="#64748B"
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          labelStyle={{ color: "#CBD5E1" }}
                        />
                        <Bar
                          dataKey={charts.bar_chart.y}
                          fill="#06B6D4"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState text="No bar chart available for this dataset." />
                )}
              </div>

              <div style={analyticsCardStyle}>
                <div style={cardHeaderStyle}>
                  <div>
                    <div style={cardEyebrowStyle}>DISTRIBUTION</div>
                    <h3 style={cardTitleStyle}>Histogram</h3>
                  </div>
                  <span style={purpleBadgeStyle}>AUTO</span>
                </div>

                {charts?.histogram ? (
                  <div style={chartAreaStyle}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={charts.histogram.data.map((value) => ({
                          value,
                        }))}
                      >
                        <CartesianGrid
                          stroke="#1E293B"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="value"
                          stroke="#64748B"
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                        />
                        <YAxis
                          stroke="#64748B"
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar
                          dataKey="value"
                          fill="#7C3AED"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState text="No histogram available for this dataset." />
                )}
              </div>
            </div>
          </section>

          {/* AI RESULT */}
          {askResult && (
            <section style={sectionStyle}>
              <SectionHeading
                eyebrow="AI ANALYSIS"
                title="Your Data, Explained"
                subtitle="The result generated from your natural-language question."
              />

              <div className="result-grid" style={resultGridStyle}>
                <div style={aiInsightCardStyle}>
                  <div style={cardHeaderStyle}>
                    <div>
                      <div style={cardEyebrowStyle}>INTELLIGENCE</div>
                      <h3 style={cardTitleStyle}>AI Insights</h3>
                    </div>
                    <span style={aiLiveBadgeStyle}>✦ AI</span>
                  </div>

                  <div style={answerBoxStyle}>
                    <div style={answerLabelStyle}>ANSWER</div>
                    <p style={answerTextStyle}>
                      {askResult.ai?.plain_language_answer ||
                        answer ||
                        "No answer available."}
                    </p>
                  </div>

                  <div style={insightsListStyle}>
                    {insights.length > 0 ? (
                      insights.map((item, index) => (
                        <div key={index} style={insightItemStyle}>
                          <span style={insightBulletStyle}>✦</span>
                          <span>{item}</span>
                        </div>
                      ))
                    ) : (
                      <div style={mutedTextStyle}>
                        Ask another question to generate more insights.
                      </div>
                    )}
                  </div>
                </div>

                <div style={sqlCardStyle}>
                  <div style={cardHeaderStyle}>
                    <div>
                      <div style={cardEyebrowStyle}>QUERY ENGINE</div>
                      <h3 style={cardTitleStyle}>Generated SQL</h3>
                    </div>
                    <span style={secureBadgeStyle}>READ ONLY</span>
                  </div>

                  <div style={sqlWindowStyle}>
                    <div style={sqlTopBarStyle}>
                      <span style={{ ...windowDotStyle, background: "#EF4444" }} />
                      <span style={{ ...windowDotStyle, background: "#F59E0B" }} />
                      <span style={{ ...windowDotStyle, background: "#22C55E" }} />
                      <span style={sqlFileLabelStyle}>query.sql</span>
                    </div>

                    <pre style={sqlCodeStyle}>
                      {askResult.ai?.sql_query ||
                        "-- SQL query will appear here"}
                    </pre>
                  </div>

                  <div style={sqlMetaStyle}>
                    <span>
                      {askResult.result?.row_count ?? 0} result row
                      {askResult.result?.row_count === 1 ? "" : "s"}
                    </span>
                    <span>•</span>
                    <span>Validated query</span>
                  </div>
                </div>
              </div>

              {/* ASK RESULT TABLE */}
              <div style={{ ...analyticsCardStyle, marginTop: 18 }}>
                <div style={cardHeaderStyle}>
                  <div>
                    <div style={cardEyebrowStyle}>QUERY RESULT</div>
                    <h3 style={cardTitleStyle}>Returned Data</h3>
                  </div>
                  <span style={neutralBadgeStyle}>
                    {askResult.result?.row_count ?? 0} rows
                  </span>
                </div>

                {askResult.result?.columns?.length > 0 &&
                askResult.result?.rows?.length > 0 ? (
                  <div style={tableWrapStyle}>
                    <table style={darkTableStyle}>
                      <thead>
                        <tr>
                          {askResult.result.columns.map((column) => (
                            <th key={column} style={darkThStyle}>
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {askResult.result.rows.map((row, index) => (
                          <tr key={index}>
                            {askResult.result.columns.map((column) => (
                              <td key={column} style={darkTdStyle}>
                                {String(row[column] ?? "-")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState text="No tabular result returned." />
                )}
              </div>

              {/* AI VISUALIZATION */}
              {askResult.ai?.chart_type &&
                askResult.ai.chart_type !== "none" &&
                askResult.result?.rows?.length > 0 &&
                askResult.result?.columns?.length >= 2 && (
                  <div style={{ ...analyticsCardStyle, marginTop: 18 }}>
                    <div style={cardHeaderStyle}>
                      <div>
                        <div style={cardEyebrowStyle}>AI VISUALIZATION</div>
                        <h3 style={cardTitleStyle}>
                          {askResult.ai?.title || "Generated Visualization"}
                        </h3>
                      </div>
                      <span style={cyanBadgeStyle}>
                        {askResult.ai.chart_type}
                      </span>
                    </div>

                    <div style={chartAreaStyle}>
                      <ResponsiveContainer width="100%" height={340}>
                        {renderAskChart()}
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
            </section>
          )}

          {/* PREVIEW */}
          <section style={sectionStyle}>
            <SectionHeading
              eyebrow="RAW DATA"
              title="Dataset Preview"
              subtitle={`Showing a preview of ${columnNames.length} detected columns.`}
            />

            <div style={analyticsCardStyle}>
              <div style={tableWrapStyle}>
                <table style={darkTableStyle}>
                  <thead>
                    <tr>
                      {columnNames.map((col) => (
                        <th key={col} style={darkThStyle}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i}>
                        {columnNames.map((col) => (
                          <td key={col} style={darkTdStyle}>
                            {String(row[col] ?? "-")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* NUMERIC SUMMARY */}
          <section style={sectionStyle}>
            <SectionHeading
              eyebrow="STATISTICS"
              title="Numeric Summary"
              subtitle="Statistical measures calculated from detected numeric columns."
            />

            {summary?.numeric_summary ? (
              <div style={analyticsCardStyle}>
                <div style={tableWrapStyle}>
                  <table style={darkTableStyle}>
                    <thead>
                      <tr>
                        {[
                          "Column",
                          "Mean",
                          "Median",
                          "Min",
                          "Max",
                          "Std Dev",
                        ].map((item) => (
                          <th key={item} style={darkThStyle}>
                            {item}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(summary.numeric_summary).map(
                        ([column, stats]) => (
                          <tr key={column}>
                            <td style={{ ...darkTdStyle, fontWeight: 600 }}>
                              {column}
                            </td>
                            <td style={darkTdStyle}>{stats.mean}</td>
                            <td style={darkTdStyle}>{stats.median}</td>
                            <td style={darkTdStyle}>{stats.min}</td>
                            <td style={darkTdStyle}>{stats.max}</td>
                            <td style={darkTdStyle}>{stats.std}</td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState text="No numeric summary available." />
            )}
          </section>
        </main>
      </div>
    </>
  );
}

function SectionHeading({ eyebrow, title, subtitle }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={cardEyebrowStyle}>{eyebrow}</div>
      <h2 style={sectionTitleStyle}>{title}</h2>
      <p style={sectionSubtitleStyle}>{subtitle}</p>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={emptyStateStyle}>
      <span style={{ color: "#06B6D4", fontSize: 20 }}>◌</span>
      <span>{text}</span>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#0B0F19",
  color: "#F8FAFC",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
};

const appShellStyle = {
  minHeight: "100vh",
  background: "#0B0F19",
  color: "#F8FAFC",
  display: "flex",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
};

const sidebarStyle = {
  width: 245,
  flexShrink: 0,
  minHeight: "100vh",
  position: "sticky",
  top: 0,
  alignSelf: "flex-start",
  boxSizing: "border-box",
  padding: "28px 18px",
  borderRight: "1px solid #1E293B",
  background: "rgba(9, 13, 23, 0.96)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const mainStyle = {
  width: "100%",
  maxWidth: 1450,
  margin: "0 auto",
  padding: "38px 42px 80px",
  boxSizing: "border-box",
};

const brandStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "#F8FAFC",
  textDecoration: "none",
  fontWeight: 800,
  fontSize: 18,
  letterSpacing: "-0.03em",
  marginBottom: 28,
};

const brandMarkStyle = {
  width: 32,
  height: 32,
  display: "grid",
  placeItems: "center",
  borderRadius: 9,
  color: "#FFFFFF",
  background: "linear-gradient(135deg, #7C3AED, #06B6D4)",
  boxShadow: "0 0 25px rgba(124,58,237,0.35)",
};

const uploadButtonStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
  padding: "12px 14px",
  borderRadius: 9,
  color: "#FFFFFF",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 13,
  background: "linear-gradient(135deg, #7C3AED, #6D28D9)",
  boxShadow: "0 0 24px rgba(124,58,237,0.22)",
};

const uploadIconStyle = {
  fontSize: 18,
  lineHeight: 1,
};

const navStyle = {
  marginTop: 34,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const navLabelStyle = {
  color: "#475569",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.12em",
  margin: "0 10px 8px",
};

const navItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "11px 12px",
  borderRadius: 8,
  color: "#64748B",
  fontSize: 14,
  textDecoration: "none",
  cursor: "default",
};

const activeNavItemStyle = {
  color: "#E2E8F0",
  background: "rgba(124,58,237,0.12)",
  border: "1px solid rgba(124,58,237,0.24)",
};

const sidebarBottomStyle = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "12px 10px",
  borderTop: "1px solid #1E293B",
};

const statusDotStyle = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "#22C55E",
  boxShadow: "0 0 12px rgba(34,197,94,0.7)",
};

const topbarStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 20,
  marginBottom: 30,
};

const eyebrowStyle = {
  color: "#64748B",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.13em",
  marginBottom: 8,
};

const pageTitleStyle = {
  margin: 0,
  fontSize: "clamp(26px, 3vw, 38px)",
  lineHeight: 1.05,
  letterSpacing: "-0.045em",
};

const pageSubtitleStyle = {
  color: "#64748B",
  margin: "10px 0 0",
  fontSize: 14,
};

const secondaryButtonStyle = {
  padding: "10px 15px",
  borderRadius: 8,
  border: "1px solid #334155",
  background: "#111827",
  color: "#CBD5E1",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
};

const askHeroStyle = {
  position: "relative",
  overflow: "hidden",
  padding: "30px 30px 26px",
  borderRadius: 12,
  border: "1px solid #273449",
  background:
    "linear-gradient(135deg, rgba(18,24,40,0.98), rgba(10,18,30,0.98))",
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
};

const askHeroGlowStyle = {
  position: "absolute",
  width: 260,
  height: 260,
  right: -100,
  top: -150,
  borderRadius: "50%",
  background: "rgba(6,182,212,0.12)",
  filter: "blur(50px)",
};

const aiBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  color: "#67E8F9",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.12em",
};

const pulseStyle = {
  color: "#06B6D4",
  textShadow: "0 0 14px rgba(6,182,212,0.8)",
};

const askTitleStyle = {
  margin: "9px 0 7px",
  fontSize: "clamp(25px, 3vw, 34px)",
  letterSpacing: "-0.04em",
};

const askSubtitleStyle = {
  margin: 0,
  color: "#64748B",
  fontSize: 14,
};

const searchRowStyle = {
  display: "flex",
  gap: 10,
  marginTop: 22,
};

const searchInputWrapStyle = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
  border: "1px solid #334155",
  borderRadius: 9,
  background: "#080D17",
  padding: "0 14px",
  boxShadow: "inset 0 0 25px rgba(0,0,0,0.18)",
};

const searchIconStyle = {
  color: "#06B6D4",
  fontSize: 23,
};

const searchInputStyle = {
  width: "100%",
  border: 0,
  outline: 0,
  background: "transparent",
  color: "#F8FAFC",
  fontSize: 14,
  padding: "15px 0",
};

const askButtonStyle = {
  border: 0,
  borderRadius: 9,
  padding: "0 20px",
  background: "linear-gradient(135deg, #7C3AED, #6D28D9)",
  color: "#FFFFFF",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 0 25px rgba(124,58,237,0.2)",
};

const suggestionsStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 13,
};

const suggestionStyle = {
  border: "1px solid #263246",
  borderRadius: 999,
  background: "#0D1422",
  color: "#94A3B8",
  padding: "7px 11px",
  fontSize: 11,
  cursor: "pointer",
};

const sectionStyle = {
  marginTop: 38,
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 23,
  letterSpacing: "-0.035em",
};

const sectionSubtitleStyle = {
  color: "#64748B",
  margin: "6px 0 0",
  fontSize: 13,
};

const kpiGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
  gap: 12,
};

const kpiCardStyle = {
  minWidth: 0,
  padding: 17,
  borderRadius: 9,
  border: "1px solid #1E293B",
  background: "#0E1421",
};

const kpiTopRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const kpiIconStyle = {
  color: "#06B6D4",
  fontSize: 16,
};

const kpiIndexStyle = {
  color: "#334155",
  fontSize: 10,
  fontWeight: 800,
};

const kpiValueStyle = {
  marginTop: 18,
  fontSize: 25,
  fontWeight: 750,
  letterSpacing: "-0.04em",
};

const kpiLabelStyle = {
  marginTop: 4,
  color: "#64748B",
  fontSize: 11,
};

const chartGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
};

const analyticsCardStyle = {
  borderRadius: 10,
  border: "1px solid #1E293B",
  background: "#0E1421",
  padding: 20,
  boxShadow: "0 14px 40px rgba(0,0,0,0.15)",
};

const cardHeaderStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const cardEyebrowStyle = {
  color: "#64748B",
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: "0.13em",
  marginBottom: 6,
};

const cardTitleStyle = {
  margin: 0,
  color: "#E2E8F0",
  fontSize: 16,
};

const cyanBadgeStyle = {
  color: "#67E8F9",
  border: "1px solid rgba(6,182,212,0.25)",
  background: "rgba(6,182,212,0.08)",
  padding: "5px 8px",
  borderRadius: 6,
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: "0.08em",
};

const purpleBadgeStyle = {
  color: "#C4B5FD",
  border: "1px solid rgba(124,58,237,0.28)",
  background: "rgba(124,58,237,0.1)",
  padding: "5px 8px",
  borderRadius: 6,
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: "0.08em",
};

const neutralBadgeStyle = {
  color: "#94A3B8",
  border: "1px solid #273449",
  background: "#111827",
  padding: "5px 8px",
  borderRadius: 6,
  fontSize: 10,
};

const aiLiveBadgeStyle = {
  color: "#67E8F9",
  background: "rgba(6,182,212,0.08)",
  border: "1px solid rgba(6,182,212,0.25)",
  padding: "5px 8px",
  borderRadius: 6,
  fontSize: 10,
  fontWeight: 800,
};

const secureBadgeStyle = {
  color: "#A7F3D0",
  background: "rgba(16,185,129,0.07)",
  border: "1px solid rgba(16,185,129,0.2)",
  padding: "5px 8px",
  borderRadius: 6,
  fontSize: 9,
  fontWeight: 800,
};

const chartAreaStyle = {
  marginTop: 18,
  padding: "10px 2px 0",
};

const resultGridStyle = {
  display: "grid",
  gridTemplateColumns: "1.05fr 0.95fr",
  gap: 16,
};

const aiInsightCardStyle = {
  ...analyticsCardStyle,
  minWidth: 0,
};

const sqlCardStyle = {
  ...analyticsCardStyle,
  minWidth: 0,
};

const answerBoxStyle = {
  marginTop: 18,
  padding: "17px 18px",
  borderRadius: 8,
  border: "1px solid rgba(6,182,212,0.18)",
  background:
    "linear-gradient(135deg, rgba(6,182,212,0.07), rgba(124,58,237,0.05))",
};

const answerLabelStyle = {
  color: "#22D3EE",
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: "0.12em",
};

const answerTextStyle = {
  color: "#F8FAFC",
  fontSize: 16,
  lineHeight: 1.6,
  margin: "8px 0 0",
};

const insightsListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 11,
  marginTop: 19,
};

const insightItemStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  color: "#CBD5E1",
  fontSize: 13,
  lineHeight: 1.55,
};

const insightBulletStyle = {
  flexShrink: 0,
  color: "#7C3AED",
  textShadow: "0 0 12px rgba(124,58,237,0.7)",
};

const sqlWindowStyle = {
  marginTop: 18,
  borderRadius: 8,
  overflow: "hidden",
  border: "1px solid #1E293B",
  background: "#050914",
};

const sqlTopBarStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 11px",
  borderBottom: "1px solid #1E293B",
  background: "#0A101D",
};

const windowDotStyle = {
  width: 7,
  height: 7,
  borderRadius: "50%",
};

const sqlFileLabelStyle = {
  marginLeft: 6,
  color: "#64748B",
  fontSize: 10,
};

const sqlCodeStyle = {
  margin: 0,
  minHeight: 180,
  padding: 17,
  overflowX: "auto",
  color: "#A5F3FC",
  fontSize: 12,
  lineHeight: 1.75,
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};

const sqlMetaStyle = {
  display: "flex",
  gap: 8,
  marginTop: 10,
  color: "#64748B",
  fontSize: 10,
};

const tableWrapStyle = {
  marginTop: 16,
  overflowX: "auto",
  border: "1px solid #1E293B",
  borderRadius: 8,
};

const darkTableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 680,
};

const darkThStyle = {
  padding: "11px 13px",
  textAlign: "left",
  color: "#A5B4FC",
  background: "#111827",
  borderBottom: "1px solid #273449",
  fontSize: 11,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const darkTdStyle = {
  padding: "10px 13px",
  color: "#CBD5E1",
  borderBottom: "1px solid #172033",
  fontSize: 12,
  whiteSpace: "nowrap",
};

const emptyStateStyle = {
  minHeight: 110,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
  color: "#64748B",
  border: "1px dashed #273449",
  borderRadius: 8,
  marginTop: 16,
  fontSize: 12,
};

const loadingCardStyle = {
  ...analyticsCardStyle,
  padding: 35,
  textAlign: "center",
  maxWidth: 420,
};

const errorCardStyle = {
  ...analyticsCardStyle,
  maxWidth: 500,
  padding: 30,
};

const errorIconStyle = {
  width: 38,
  height: 38,
  display: "grid",
  placeItems: "center",
  borderRadius: "50%",
  background: "rgba(239,68,68,0.1)",
  color: "#FCA5A5",
  fontWeight: 800,
  marginBottom: 14,
};

const aiDotStyle = {
  width: 12,
  height: 12,
  margin: "0 auto 16px",
  borderRadius: "50%",
  background: "#06B6D4",
  boxShadow: "0 0 25px rgba(6,182,212,0.8)",
};

const mutedTextStyle = {
  color: "#64748B",
  fontSize: 13,
};

const primaryLinkStyle = {
  display: "inline-block",
  padding: "10px 15px",
  borderRadius: 8,
  background: "#7C3AED",
  color: "#FFFFFF",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 700,
};

const tooltipStyle = {
  background: "#0B0F19",
  border: "1px solid #334155",
  borderRadius: 8,
  color: "#E2E8F0",
};

const globalStyles = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #0B0F19;
    color: #F8FAFC;
  }
  button, input {
    font-family: inherit;
  }
  button:hover {
    filter: brightness(1.08);
  }
  a:hover {
    filter: brightness(1.08);
  }
  @media (max-width: 1100px) {
    aside {
      width: 210px !important;
    }
    main {
      padding-left: 28px !important;
      padding-right: 28px !important;
    }
    .kpi-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    }
  }
  @media (max-width: 800px) {
    aside {
      display: none !important;
    }
    main {
      padding: 24px 18px 60px !important;
    }
    .chart-grid,
    .result-grid {
      grid-template-columns: 1fr !important;
    }
    .kpi-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
    .topbar {
      flex-direction: column !important;
    }
    .search-row {
      flex-direction: column !important;
    }
    .ask-button {
      min-height: 44px !important;
    }
  }
`;

export default DatasetDashboardPage;
