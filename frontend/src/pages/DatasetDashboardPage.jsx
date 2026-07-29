import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const sampleData = [
  { name: "Jan", revenue: 30 },
  { name: "Feb", revenue: 45 },
  { name: "Mar", revenue: 20 },
  { name: "Apr", revenue: 60 },
];
function DatasetDashboardPage() {
  const { datasetId } = useParams();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [preview, setPreview] = useState(null);
  const [regionChart, setRegionChart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      if (!API_BASE_URL) {
        setErrorMessage("VITE_API_BASE_URL is missing in frontend .env.");
        setLoading(false);
        return;
      }

      if (!datasetId) {
        setErrorMessage("Dataset ID is missing.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const [summaryRes, previewRes, regionRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/datasets/${datasetId}/summary`, {
            signal: controller.signal,
          }),
          fetch(`${API_BASE_URL}/api/datasets/${datasetId}/preview`, {
            signal: controller.signal,
          }),
          fetch(`${API_BASE_URL}/api/datasets/${datasetId}/charts/revenue-by-region`, {
            signal: controller.signal,
          }),
        ]);

        const summaryData = await summaryRes.json().catch(() => null);
        const previewData = await previewRes.json().catch(() => null);
        const regionData = await regionRes.json().catch(() => null);
        if (!summaryRes.ok) {
          const detail = summaryData?.detail || "Failed to load dataset summary.";
          throw new Error(
            typeof detail === "string" ? detail : JSON.stringify(detail, null, 2)
          );
        }

        if (!previewRes.ok) {
          const detail = previewData?.detail || "Failed to load dataset preview.";
          throw new Error(
            typeof detail === "string" ? detail : JSON.stringify(detail, null, 2)
          );
        }

        setSummary(summaryData);
        setPreview(previewData);
        setRegionChart(regionData?.data || []);
      } catch (error) {
        if (error.name !== "AbortError") {
          setErrorMessage(error.message || "Something went wrong.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
    return () => controller.abort();
  }, [datasetId]);

  const dataset = summary?.dataset || preview?.dataset || null;
  const rows = preview?.preview_rows || [];
  const columns = preview?.column_names || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-sm text-emerald-400 hover:text-emerald-300"
            >
              ← Back to upload
            </button>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Dataset Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              View summary KPIs and preview the first 10 rows.
            </p>
          </div>

          {dataset && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
              <p className="text-slate-400">Dataset</p>
              <p className="font-medium text-slate-100">{dataset.file_name}</p>
            </div>
          )}
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="h-6 w-48 animate-pulse rounded bg-slate-800" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-800" />
              ))}
            </div>
            <div className="mt-6 h-64 animate-pulse rounded-xl bg-slate-800" />
          </div>
        )}

        {!loading && errorMessage && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">
            <p className="font-semibold">Error</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{errorMessage}</p>
            <div className="mt-4">
              <Link to="/" className="text-sm text-emerald-400 hover:text-emerald-300">
                Go back to upload page
              </Link>
            </div>
          </div>          
          
        )}

        {!loading && !errorMessage && summary && preview && (
          <div className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Row count"
                value={dataset?.row_count ?? "-"}
                helper="Total rows in the uploaded dataset"
              />
              <KpiCard
                label="Column count"
                value={dataset?.column_count ?? "-"}
                helper="Total columns detected"
              />
              <KpiCard
                label="Total Revenue"
                value={formatNumber(summary?.kpis?.total_revenue?.value)}
                helper={summary?.kpis?.total_revenue?.meaning}
              />
              <KpiCard
                label="Total Profit"
                value={formatNumber(summary?.kpis?.total_profit?.value)}
                helper={summary?.kpis?.total_profit?.meaning}
              />
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Total Orders"
                value={formatNumber(summary?.kpis?.total_orders?.value)}
                helper={summary?.kpis?.total_orders?.meaning}
              />
              <KpiCard
                label="Top Product"
                value={summary?.kpis?.top_selling_product_by_revenue?.value || "-"}
                helper={`Revenue: ${formatNumber(
                  summary?.kpis?.top_selling_product_by_revenue?.revenue
                )}`}
              />
              <KpiCard
                label="Top Region"
                value={summary?.kpis?.top_region_by_revenue?.value || "-"}
                helper={`Revenue: ${formatNumber(
                  summary?.kpis?.top_region_by_revenue?.revenue
                )}`}
              />
              <KpiCard
                label="Dataset ID"
                value={datasetId}
                helper="Stored in the URL as a route param"
              />
            </section>
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

       <h2 className="text-xl font-semibold mb-5">
        Revenue by Region
           </h2>

        <div style={{ width: "100%", height: 350 }}>
       <ResponsiveContainer width="100%" height="100%">
        <BarChart data={regionChart}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="region" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar
          dataKey="revenue"
          fill="#10B981"
          radius={[8, 8, 0, 0]}
          />
         </BarChart>
         </ResponsiveContainer>
         </div>

        </section>
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Preview Table</h2>
                  <p className="text-sm text-slate-400">
                    First 10 rows from the dataset.
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  Columns detected: {columns.length}
                </p>
              </div>

              {rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-500">
                  No preview rows found.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="min-w-full divide-y divide-slate-800 text-sm">
                    <thead className="bg-slate-950">
                      <tr>
                        {columns.map((col) => (
                          <th
                            key={col}
                            className="px-4 py-3 text-left font-medium text-slate-300"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900">
                      {rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          {columns.map((col) => (
                            <td key={col} className="px-4 py-3 text-slate-200">
                              {String(row[col] ?? "-")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {!loading && !errorMessage && !summary && !preview && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-400">
            No data available.
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, helper }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/20">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-100">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{helper}</p>
    </div>
  );
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat("en-IN").format(num);
}

export default DatasetDashboardPage;