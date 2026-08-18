import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export default function UploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const chooseFile = (selected) => {
    const next = selected?.[0];
    setError("");

    if (!next) return;

    if (!next.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setError("Only CSV files are allowed.");
      return;
    }

    setFile(next);
  };

  const upload = async () => {
    if (!file || uploading) return;

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${API_BASE_URL}/api/datasets/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : data.detail?.message || "Upload failed.";
        throw new Error(detail);
      }

      const id = data.dataset?.dataset_id;

      if (!id) {
        throw new Error("Upload succeeded but no dataset ID was returned.");
      }

      navigate(`/dashboard/${id}`);
    } catch (err) {
      setError(err.message || "Could not upload dataset.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={ambientOne} />
      <div style={ambientTwo} />

      <header style={topbarStyle}>
        <button onClick={() => navigate("/")} style={brandButton}>
          <span style={brandMark}>✦</span>
          <span>DataSense<span style={{ color: "#06B6D4" }}>AI</span></span>
        </button>

        <div style={topbarStatus}>
          <span style={onlineDot} />
          AI Engine Online
        </div>
      </header>

      <main style={contentStyle}>
        <div style={eyebrowStyle}>DATA IMPORT</div>
        <h1 style={titleStyle}>Bring your data to life.</h1>
        <p style={subtitleStyle}>
          Upload a CSV and DataSense AI will generate a clean preview,
          dataset summary, visual analytics, and an AI-powered query workspace.
        </p>

        <div
          style={{
            ...dropZoneStyle,
            ...(dragging ? activeDropZoneStyle : {}),
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            chooseFile(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => chooseFile(e.target.files)}
          />

          <div style={uploadIcon}>↑</div>
          <div style={dropTitle}>
            {file ? file.name : "Drop your CSV here"}
          </div>
          <div style={dropText}>
            {file
              ? `${(file.size / 1024).toFixed(1)} KB selected`
              : "or click anywhere to browse from your computer"}
          </div>

          <div style={formatPill}>
            <span>CSV</span>
            <span>•</span>
            <span>Ready for analysis</span>
          </div>
        </div>

        {error && <div style={errorStyle}>⚠ {error}</div>}

        <div style={bottomRow}>
          <div style={infoCard}>
            <div style={infoIcon}>✦</div>
            <div>
              <strong>What happens next?</strong>
              <p>
                Your dataset is processed into a searchable analytics dashboard
                with dynamic charts and natural-language SQL analysis.
              </p>
            </div>
          </div>

          <button
            onClick={upload}
            disabled={!file || uploading}
            style={{
              ...uploadButtonStyle,
              opacity: !file || uploading ? 0.5 : 1,
              cursor: !file || uploading ? "not-allowed" : "pointer",
            }}
          >
            {uploading ? "Uploading..." : "Analyze Dataset  →"}
          </button>
        </div>
      </main>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#0B0F19",
  color: "#F8FAFC",
  fontFamily: "Inter, Roboto, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  position: "relative",
  overflow: "hidden",
};

const ambientOne = {
  position: "fixed",
  width: 520,
  height: 520,
  borderRadius: "50%",
  background: "rgba(124,58,237,0.12)",
  filter: "blur(100px)",
  top: -250,
  right: -160,
  pointerEvents: "none",
};

const ambientTwo = {
  position: "fixed",
  width: 420,
  height: 420,
  borderRadius: "50%",
  background: "rgba(6,182,212,0.08)",
  filter: "blur(110px)",
  bottom: -220,
  left: -170,
  pointerEvents: "none",
};

const topbarStyle = {
  height: 76,
  padding: "0 6%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: "1px solid #1E293B",
  background: "rgba(11,15,25,0.82)",
  backdropFilter: "blur(18px)",
  position: "relative",
  zIndex: 2,
};

const brandButton = {
  border: 0,
  background: "transparent",
  color: "#F8FAFC",
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 20,
  fontWeight: 800,
  cursor: "pointer",
};

const brandMark = {
  width: 34,
  height: 34,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg,#7C3AED,#06B6D4)",
  boxShadow: "0 0 24px rgba(124,58,237,0.35)",
};

const topbarStatus = {
  color: "#94A3B8",
  fontSize: 13,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const onlineDot = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#22C55E",
  boxShadow: "0 0 12px rgba(34,197,94,.8)",
};

const contentStyle = {
  width: "min(1050px, 90%)",
  margin: "0 auto",
  padding: "76px 0 100px",
  position: "relative",
  zIndex: 1,
};

const eyebrowStyle = {
  color: "#06B6D4",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.16em",
  marginBottom: 12,
};

const titleStyle = {
  margin: 0,
  fontSize: "clamp(38px, 6vw, 64px)",
  lineHeight: 1.02,
  letterSpacing: "-0.045em",
  maxWidth: 720,
};

const subtitleStyle = {
  color: "#94A3B8",
  fontSize: 16,
  lineHeight: 1.7,
  maxWidth: 700,
  margin: "20px 0 40px",
};

const dropZoneStyle = {
  minHeight: 360,
  border: "1px dashed #334155",
  borderRadius: 18,
  background:
    "linear-gradient(145deg, rgba(15,23,42,.86), rgba(15,23,42,.54))",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all .2s ease",
  boxShadow: "0 24px 70px rgba(0,0,0,.28)",
};

const activeDropZoneStyle = {
  border: "1px solid #06B6D4",
  background:
    "linear-gradient(145deg, rgba(6,182,212,.10), rgba(124,58,237,.10))",
  boxShadow: "0 0 45px rgba(6,182,212,.12)",
  transform: "translateY(-2px)",
};

const uploadIcon = {
  width: 72,
  height: 72,
  borderRadius: 20,
  display: "grid",
  placeItems: "center",
  fontSize: 34,
  color: "#E0F2FE",
  background: "linear-gradient(135deg, rgba(124,58,237,.24), rgba(6,182,212,.18))",
  border: "1px solid #334155",
  marginBottom: 22,
};

const dropTitle = {
  fontSize: 22,
  fontWeight: 750,
  color: "#F8FAFC",
};

const dropText = {
  marginTop: 8,
  color: "#64748B",
  fontSize: 14,
};

const formatPill = {
  marginTop: 22,
  display: "flex",
  gap: 9,
  alignItems: "center",
  color: "#94A3B8",
  border: "1px solid #1E293B",
  borderRadius: 999,
  padding: "8px 13px",
  background: "rgba(2,6,23,.42)",
  fontSize: 12,
};

const bottomRow = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 18,
  alignItems: "stretch",
};

const infoCard = {
  display: "flex",
  gap: 14,
  padding: 20,
  border: "1px solid #1E293B",
  borderRadius: 14,
  background: "rgba(15,23,42,.62)",
  color: "#CBD5E1",
};

const infoIcon = {
  width: 34,
  height: 34,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  color: "#67E8F9",
  background: "rgba(6,182,212,.09)",
  border: "1px solid rgba(6,182,212,.2)",
};

const infoCardText = {};
const uploadButtonStyle = {
  minWidth: 210,
  border: 0,
  borderRadius: 12,
  padding: "0 24px",
  background: "linear-gradient(135deg,#7C3AED,#6D28D9)",
  color: "white",
  fontSize: 14,
  fontWeight: 750,
  boxShadow: "0 12px 35px rgba(124,58,237,.25)",
};
const errorStyle = {
  marginTop: 16,
  padding: "13px 16px",
  borderRadius: 12,
  border: "1px solid rgba(239,68,68,.3)",
  background: "rgba(127,29,29,.16)",
  color: "#FCA5A5",
};