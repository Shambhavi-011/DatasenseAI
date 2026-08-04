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

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function DatasetDashboardPage() {
  const { datasetId } = useParams();

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