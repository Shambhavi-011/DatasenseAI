import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setError("");
    setSuccess("");
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file) {
      setError("Please select a CSV file.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Only CSV files are allowed.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE_URL}/api/datasets/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : "Upload failed. Please try again."
        );
      }

      const datasetId = data?.dataset?.dataset_id;
      setSuccess("File uploaded successfully.");

      if (datasetId) {
        navigate(`/dashboard/${datasetId}`);
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", padding: 20 }}>
      <h1>Upload CSV Dataset</h1>
      <p>Upload a CSV file to generate preview, summary, and charts.</p>

      <form onSubmit={handleUpload}>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          style={{ marginBottom: 16 }}
        />
        <br />
        <button type="submit" disabled={loading}>
          {loading ? "Uploading..." : "Upload"}
        </button>
      </form>

      {error && (
        <p style={{ color: "red", marginTop: 16 }}>
          {error}
        </p>
      )}

      {success && (
        <p style={{ color: "green", marginTop: 16 }}>
          {success}
        </p>
      )}
    </div>
  );
}

export default UploadPage;