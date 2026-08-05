import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { askDataset } from "../services/askService";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function DatasetDashboardPage() {
  const { datasetId } = useParams();
  
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
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
      {
        title: "Rows",
        value: summary.overview.rows,
      },
      {
        title: "Columns",
        value: summary.overview.columns,
      },
      {
        title: "Numeric Columns",
        value: summary.overview.numeric_columns,
      },
      {
        title: "Categorical Columns",
        value: summary.overview.categorical_columns,
      },
      {
        title: "Missing Values",
        value: summary.overview.missing_values,
      },
      {
        title: "Duplicate Rows",
        value: summary.overview.duplicate_rows,
      },
    ];
  }, [summary]);

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: "40px auto", padding: 20 }}>
        <h2>Loading Dashboard...</h2>
      </div>
    );
  }

  if (pageError) {
    return (
      <div style={{ maxWidth: 1200, margin: "40px auto", padding: 20 }}>
        <h2 style={{ color: "red" }}>Error</h2>
        <p>{pageError}</p>

        <Link to="/">Go Back</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "40px auto", padding: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 25,
        }}
      >
        <div>
          <h1>Dataset Dashboard</h1>

          <p>
            {dataset?.file_name}
            <br />
            Dataset ID : {datasetId}
          </p>
        </div>

        <Link
          to="/"
          style={{
            padding: "10px 18px",
            background: "#111827",
            color: "white",
            textDecoration: "none",
            borderRadius: 8,
          }}
        >
          Upload New Dataset
        </Link>
      </div>

      <section>
        <h2>Dataset Overview</h2>

        <div style={kpiGridStyle}>
          {overviewCards.map((card) => (
            <div key={card.title} style={cardStyle}>
              <h3>{card.title}</h3>

              <h2>{card.value}</h2>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 40 }}>
        <h2>Preview</h2>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {columnNames.map((col) => (
                  <th key={col} style={thTdStyle}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i}>
                  {columnNames.map((col) => (
                    <td key={col} style={thTdStyle}>
                      {String(row[col] ?? "-")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 50 }}>

     <h2>🤖 Ask Your Data</h2>

       <p style={{ color: "#666" }}>
           Ask questions about any uploaded dataset using natural language.
         </p>

          <input
  type="text"
  value={question}
  onChange={(e) => setQuestion(e.target.value)}
  placeholder="Example: Find the highest values, summarize this dataset, show trends, detect missing values..."
  style={{
    width: "100%",
    padding: "14px",
    fontSize: "16px",
    borderRadius: "10px",
    border: "1px solid #ddd",
    marginTop: "15px",
  }}
/>

<div
  style={{
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "20px",
  }}
>
  {[
    "Summarize this dataset",
    "Show important trends",
    "Which column contains the highest values?",
    "Are there any missing values?",
    "Show distribution of numeric columns",
  ].map((item) => (
    <button
      key={item}
      onClick={() => setQuestion(item)}
      style={{
        padding: "8px 14px",
        borderRadius: "20px",
        border: "1px solid #ccc",
        background: "#f5f5f5",
        cursor: "pointer",
      }}
    >
      {item}
    </button>
  ))}
</div>

<button
  onClick={async () => {
    if (!question.trim()) return;

    try {
      setAnswer("Thinking...");

      // Future backend integration
      const result = await askDataset(datasetId, question);

setAnswer(result.answer);

      setAnswer(
              );
    } catch (err) {
      setAnswer("Something went wrong.");
    }
  }}
  style={{
    marginTop: "18px",
    padding: "12px 24px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  }}
>
  Ask
</button>
<div
  style={{
    marginTop: "30px",
    border: "1px solid #ddd",
    borderRadius: "12px",
    padding: "20px",
    background: "#fafafa",
  }}
>
  <h3>Answer</h3>

  {answer ? (
    <p>{answer}</p>
  ) : (
    <p style={{ color: "#888" }}>
      Ask a question to see the response here.
    </p>
  )}

  <hr style={{ margin: "20px 0" }} />

  <h3>Table</h3>

  <div
    style={{
      height: "120px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "1px dashed #bbb",
      borderRadius: "8px",
    }}
  >
    Table will appear here after backend integration.
  </div>

  <hr style={{ margin: "20px 0" }} />

  <h3>Chart</h3>

  <div
    style={{
      height: "220px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "1px dashed #bbb",
      borderRadius: "8px",
    }}
  >
    Chart will appear here after backend integration.
  </div>
</div>
</section>

      <section style={{ marginTop: 40 }}>
        <h2>Dynamic Bar Chart</h2>

        {charts?.bar_chart ? (
          <div style={chartBoxStyle}>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={charts.bar_chart.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={charts.bar_chart.x} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey={charts.bar_chart.y}
                  fill="#4f46e5"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p>No bar chart available.</p>
        )}
      </section>

      <section style={{ marginTop: 40 }}>
        <h2>Histogram</h2>

        {charts?.histogram ? (
          <div style={chartBoxStyle}>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={charts.histogram.data.map((value) => ({
                  value,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="value" />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey="value"
                  fill="#16a34a"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p>No histogram available.</p>
        )}
      </section>

      <section style={{ marginTop: 40 }}>
        <h2>Numeric Summary</h2>

        {summary?.numeric_summary ? (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thTdStyle}>Column</th>
                  <th style={thTdStyle}>Mean</th>
                  <th style={thTdStyle}>Median</th>
                  <th style={thTdStyle}>Min</th>
                  <th style={thTdStyle}>Max</th>
                  <th style={thTdStyle}>Std Dev</th>
                </tr>
              </thead>

              <tbody>
                {Object.entries(summary.numeric_summary).map(
                  ([column, stats]) => (
                    <tr key={column}>
                      <td style={thTdStyle}>{column}</td>
                      <td style={thTdStyle}>{stats.mean}</td>
                      <td style={thTdStyle}>{stats.median}</td>
                      <td style={thTdStyle}>{stats.min}</td>
                      <td style={thTdStyle}>{stats.max}</td>
                      <td style={thTdStyle}>{stats.std}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No numeric summary available.</p>
        )}
      </section>
    </div>
  );
}

const kpiGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 16,
  marginTop: 20,
};

const cardStyle = {
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 5px rgba(0,0,0,0.08)",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 700,
};

const thTdStyle = {
  border: "1px solid #ddd",
  padding: 10,
  textAlign: "left",
};

const chartBoxStyle = {
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: 12,
  padding: 20,
};

export default DatasetDashboardPage;