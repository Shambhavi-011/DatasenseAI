import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function UploadPage() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [datasetInfo, setDatasetInfo] = useState(null);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setSuccessMessage("");
    setErrorMessage("");
    setDatasetInfo(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage("Please select a CSV file before uploading.");
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setErrorMessage("Only CSV files are allowed.");
      return;
    }

    if (!API_BASE_URL) {
      setErrorMessage("VITE_API_BASE_URL is missing in frontend .env.");
      return;
    }

    setIsUploading(true);
    setSuccessMessage("");
    setErrorMessage("");
    setDatasetInfo(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${API_BASE_URL}/api/datasets/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const detail = data?.detail || data?.message || "Upload failed.";
        setErrorMessage(
          typeof detail === "string" ? detail : JSON.stringify(detail, null, 2)
        );
        return;
      }

      setSuccessMessage(data?.message || "Dataset uploaded successfully.");
      setDatasetInfo(data?.dataset || null);

      if (data?.dataset?.dataset_id) {
        navigate(`/dashboard/${data.dataset.dataset_id}`);
      }
    } catch (error) {
      setErrorMessage("Could not reach the backend. Check if FastAPI is running.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">DataSense AI</h1>
          <p className="mt-2 text-sm text-slate-400">
            Upload a CSV dataset and explore its summary in one clean dashboard.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-black/20">
            <h2 className="text-xl font-semibold">Upload CSV</h2>
            <p className="mt-2 text-sm text-slate-400">
              Select your sales dataset and send it to the backend.
            </p>

            <div className="mt-6 space-y-4">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="block w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 file:mr-4 file:rounded-md file:border-0 file:bg-emerald-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-black hover:file:bg-emerald-400"
              />

              {selectedFile && (
                <p className="text-xs text-slate-400">
                  Selected file:{" "}
                  <span className="font-medium text-slate-200">
                    {selectedFile.name}
                  </span>
                </p>
              )}

              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
              >
                {isUploading ? "Uploading..." : "Upload dataset"}
              </button>

              {successMessage && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                  {successMessage}
                </div>
              )}

              {errorMessage && (
                <div className="whitespace-pre-wrap rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {errorMessage}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-black/20">
            <h2 className="text-xl font-semibold">Latest upload details</h2>
            <p className="mt-2 text-sm text-slate-400">
              After upload, dataset metadata appears here.
            </p>

            {!datasetInfo ? (
              <div className="mt-6 flex min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-700 text-sm text-slate-500">
                No dataset uploaded yet.
              </div>
            ) : (
              <div className="mt-6 space-y-4 text-sm">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Info label="Dataset ID" value={datasetInfo.dataset_id} />
                  <Info label="File name" value={datasetInfo.file_name} />
                  <Info label="Table name" value={datasetInfo.table_name} />
                  <Info
                    label="Rows / Columns"
                    value={`${datasetInfo.row_count} / ${datasetInfo.column_count}`}
                  />
                </div>

                {Array.isArray(datasetInfo.column_names) &&
                  datasetInfo.column_names.length > 0 && (
                    <div>
                      <p className="mb-2 text-slate-400">Columns</p>
                      <div className="flex flex-wrap gap-2">
                        {datasetInfo.column_names.map((col) => (
                          <span
                            key={col}
                            className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-200"
                          >
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-all font-medium text-slate-100">{value}</p>
    </div>
  );
}

export default UploadPage;