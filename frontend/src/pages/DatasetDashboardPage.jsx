import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function DatasetDashboardPage() {
  const { datasetId } = useParams();

  const [dataset, setDataset] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [columnNames, setColumnNames] = useState([]);
  const [summary, setSummary] = useState(null);
  const [regionChart, setRegionChart] = useState([]);
  const [productChart, setProductChart] = useState([]);
  const [monthlyChart, setMonthlyChart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [chartErrors, setChartErrors] = useState({});

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        setPageError("");
        setChartErrors({});

        const [previewRes, summaryRes, regionRes, productRes, monthlyRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/datasets/${datasetId}/preview`),
          fetch(`${API_BASE_URL}/api/datasets/${datasetId}/summary`),
          fetch(`${API_BASE_URL}/api/datasets/${datasetId}/charts/revenue-by-region`),
          fetch(`${API_BASE_URL}/api/datasets/${datasetId}/charts/revenue-by-product`),
          fetch(`${API_BASE_URL}/api/datasets/${datasetId}/charts/monthly-revenue`),
        ]);

        const previewData = await previewRes.json();
        const summaryData = await summaryRes.json();
        const regionData = await regionRes.json();
        const productData = await productRes.json();
        const monthlyData = await monthlyRes.json();

        if (!previewRes.ok) throw new Error(previewData?.detail || "Failed to load preview.");
        if (!summaryRes.ok) throw new Error(summaryData?.detail?.message || summaryData?.detail || "Failed to load summary.");

        setDataset(previewData.dataset);
        setPreviewRows(previewData.preview_rows || []);
        setColumnNames(previewData.column_names || []);
        setSummary(summaryData.kpis || {});

        if (regionRes.ok) setRegionChart(regionData.data || []);
        else setChartErrors((prev) => ({ ...prev, region: regionData?.detail?.message || regionData?.detail || "Region chart failed." }));

        if (productRes.ok) setProductChart(productData.data || []);
        else setChartErrors((prev) => ({ ...prev, product: productData?.detail?.message || productData?.detail || "Product chart failed." }));

        if (monthlyRes.ok) setMonthlyChart(monthlyData.data || []);
        else setChartErrors((prev) => ({ ...prev, monthly: monthlyData?.detail?.message || monthlyData?.detail || "Monthly chart failed." }));
      } catch (err) {
        setPageError(err.message || "Something went wrong.");
      } finally {
        setLoading(false);
      }
    };

    if (datasetId) fetchAllData();
  }, [datasetId]);

  const kpiCards = useMemo(() => {
    if (!summary) return [];
    return [
      { title: "Total Revenue", value: summary.total_revenue?.value ?? "-" },
      { title: "Total Quantity Sold", value: summary.total_quantity_sold?.value ?? "-" },
      { title: "Total Orders", value: summary.total_orders?.value ?? "-" },
      {
        title: "Top Product",
        value: summary.top_selling_product_by_revenue?.value ?? "-",
        sub: summary.top_selling_product_by_revenue?.revenue ? `Revenue: ${summary.top_selling_product_by_revenue.revenue}` : "",
      },
      {
        title: "Top Region",
        value: summary.top_region_by_revenue?.value ?? "-",
        sub: summary.top_region_by_revenue?.revenue ? `Revenue: ${summary.top_region_by_revenue.revenue}` : "",
      },
    ];
  }, [summary]);

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: "40px auto", padding: 20 }}>
        <h2>Loading dashboard...</h2>
      </div>
    );
  }

  if (pageError) {
    return (
      <div style={{ maxWidth: 1200, margin: "40px auto", padding: 20 }}>
        <h2 style={{ color: "red" }}>Error</h2>
        <p>{pageError}</p>
        <Link to="/">Go back to upload page</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "40px auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Dataset Dashboard</h1>
          <p style={{ margin: 0 }}>
            {dataset?.file_name || "Dataset"} | ID: {datasetId}
          </p>
        </div>
        <Link
          to="/"
          style={{
            display: "inline-block",
            padding: "10px 16px",
            borderRadius: 8,
            background: "#111827",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          Upload another file
        </Link>
      </div>

      <section style={{ marginTop: 30 }}>
        <h2>Summary KPIs</h2>
        {kpiCards.length === 0 ? (
          <p>No summary data available.</p>
        ) : (
          <div style={kpiGridStyle}>
            {kpiCards.map((card) => (
              <div key={card.title} style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>{card.title}</h3>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{card.value}</div>
                {card.sub ? <small>{card.sub}</small> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 40 }}>
        <h2>Preview</h2>
        <p>Showing first {previewRows.length} rows.</p>
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {columnNames.map((col) => (
                  <th key={col} style={thTdStyle}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.length > 0 ? (
                previewRows.map((row, index) => (
                  <tr key={index}>
                    {columnNames.map((col) => (
                      <td key={col} style={thTdStyle}>
                        {row[col] !== null && row[col] !== undefined ? String(row[col]) : "-"}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={thTdStyle} colSpan={Math.max(columnNames.length, 1)}>
                    No preview rows available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 40 }}>
        <h2>Revenue by Region</h2>
        {chartErrors.region ? <p style={{ color: "red" }}>{chartErrors.region}</p> : null}
        {regionChart.length > 0 ? (
          <div style={chartBoxStyle}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={regionChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="region" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#4f46e5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          !chartErrors.region && <p>No region chart data available.</p>
        )}
      </section>

      <section style={{ marginTop: 40 }}>
        <h2>Revenue by Product</h2>
        {chartErrors.product ? <p style={{ color: "red" }}>{chartErrors.product}</p> : null}
        {productChart.length > 0 ? (
          <div style={chartBoxStyle}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={productChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="product" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          !chartErrors.product && <p>No product chart data available.</p>
        )}
      </section>

      <section style={{ marginTop: 40 }}>
        <h2>Monthly Revenue</h2>
        {chartErrors.monthly ? <p style={{ color: "red" }}>{chartErrors.monthly}</p> : null}
        {monthlyChart.length > 0 ? (
          <div style={chartBoxStyle}>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#dc2626" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          !chartErrors.monthly && <p>No monthly chart data available.</p>
        )}
      </section>
    </div>
  );
}

const kpiGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginTop: 16,
};

const cardStyle = {
  border: "1px solid #ddd",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 800,
};

const thTdStyle = {
  border: "1px solid #ddd",
  padding: "10px 12px",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const chartBoxStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
};

export default DatasetDashboardPage;