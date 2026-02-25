"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import JSZip from "jszip";

// ----- Types -----

interface ImageFile {
  id: string;
  file: File;
  name: string;
  format: string;
  size: number;
  preview: string;
  status: "pending" | "converting" | "done" | "error";
  error?: string;
}

interface LogEntry {
  id: string;
  time: string;
  message: string;
  type: "info" | "success" | "error";
}

const OUTPUT_FORMATS = ["WebP", "AVIF", "JPEG", "JPG", "PNG", "JFIF", "BMP", "TIFF"];

const SUPPORTED_TYPES = [
  "image/webp", "image/avif", "image/jpeg", "image/png",
  "image/bmp", "image/tiff", "image/gif",
];

const ACCEPT_STRING = ".webp,.avif,.jpeg,.jpg,.png,.jfif,.bmp,.tiff,.tif,.gif";

function detectFormat(file: File): string {
  const ext = file.name.split(".").pop()?.toUpperCase() || "?";
  const typeMap: Record<string, string> = {
    "image/webp": "WEBP", "image/avif": "AVIF", "image/jpeg": "JPEG",
    "image/png": "PNG", "image/bmp": "BMP", "image/tiff": "TIFF", "image/gif": "GIF",
  };
  return typeMap[file.type] || ext;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function timestamp(): string {
  return new Date().toLocaleTimeString("pt-BR", { hour12: false });
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ----- SVG Icon components -----

function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}

// ----- Main component -----

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [images, setImages] = useState<ImageFile[]>([]);
  const [format, setFormat] = useState("WebP");
  const [quality, setQuality] = useState(90);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [convertedFiles, setConvertedFiles] = useState<{ name: string; blob: Blob }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { id: uid(), time: timestamp(), message, type }]);
  }, []);

  const isValidImage = (file: File) => {
    if (SUPPORTED_TYPES.includes(file.type)) return true;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    return ["jfif", "tif", "tiff", "avif", "webp"].includes(ext);
  };

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const newImages: ImageFile[] = [];
      for (const file of Array.from(files)) {
        if (!isValidImage(file)) continue;
        newImages.push({
          id: uid(),
          file,
          name: file.name,
          format: detectFormat(file),
          size: file.size,
          preview: URL.createObjectURL(file),
          status: "pending",
        });
      }
      if (newImages.length > 0) {
        setImages((prev) => [...prev, ...newImages]);
        addLog(`${newImages.length} imagem(ns) adicionada(s)`, "info");
      }
    },
    [addLog]
  );

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    setConvertedFiles([]);
    setProgress(0);
    addLog("Lista limpa", "info");
  }, [images, addLog]);

  // Drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  // Conversion
  const startConversion = useCallback(async () => {
    if (images.length === 0) return;
    setIsConverting(true);
    setProgress(0);
    setConvertedFiles([]);
    addLog(`Iniciando conversao de ${images.length} imagem(ns) para ${format}...`, "info");

    const results: { name: string; blob: Blob }[] = [];
    let successCount = 0;
    let errorCount = 0;

    setImages((prev) => prev.map((img) => ({ ...img, status: "pending" as const, error: undefined })));

    for (let i = 0; i < images.length; i++) {
      const img = images[i];

      setImages((prev) =>
        prev.map((item) => (item.id === img.id ? { ...item, status: "converting" as const } : item))
      );

      try {
        const formData = new FormData();
        formData.append("file", img.file);
        formData.append("format", format.toLowerCase());
        formData.append("quality", quality.toString());

        const res = await fetch("/api/convert", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Erro na conversao");
        }

        const blob = await res.blob();
        const outputName = res.headers.get("X-Output-Filename") || `${img.name}.${format.toLowerCase()}`;
        results.push({ name: outputName, blob });
        successCount++;

        setImages((prev) =>
          prev.map((item) => (item.id === img.id ? { ...item, status: "done" as const } : item))
        );
        addLog(`${img.name} \u2192 ${outputName}`, "success");
      } catch (error) {
        errorCount++;
        const msg = error instanceof Error ? error.message : "Erro desconhecido";
        setImages((prev) =>
          prev.map((item) => (item.id === img.id ? { ...item, status: "error" as const, error: msg } : item))
        );
        addLog(`${img.name}: ${msg}`, "error");
      }

      setProgress(((i + 1) / images.length) * 100);
    }

    setConvertedFiles(results);
    setIsConverting(false);
    addLog(`Conversao concluida | Sucesso: ${successCount} | Erros: ${errorCount}`, successCount > 0 ? "success" : "error");
  }, [images, format, quality, addLog]);

  // Download
  const downloadAll = useCallback(async () => {
    if (convertedFiles.length === 0) return;

    if (convertedFiles.length === 1) {
      const { name, blob } = convertedFiles[0];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const zip = new JSZip();
    for (const { name, blob } of convertedFiles) {
      zip.file(name, blob);
    }
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "imagens_convertidas.zip";
    a.click();
    URL.revokeObjectURL(url);
  }, [convertedFiles]);

  const statusLabel = (s: ImageFile["status"]) => {
    if (s === "done") return "Concluido";
    if (s === "error") return "Erro";
    if (s === "converting") return "Convertendo...";
    return "";
  };

  const statusColor = (s: ImageFile["status"]) => {
    if (s === "done") return "var(--success)";
    if (s === "error") return "var(--error)";
    if (s === "converting") return "var(--warning)";
    return "var(--text-muted)";
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ImageIcon />
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Conversor de Imagens</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>Converta imagens em massa para qualquer formato</p>
          </div>
        </div>
        <button
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          title="Alternar tema"
          style={{
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8,
            padding: 8, cursor: "pointer", color: "var(--text-primary)", display: "flex",
            alignItems: "center", justifyContent: "center", transition: "all 0.2s",
          }}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      {/* Drop Zone */}
      <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", padding: 20, marginBottom: 16, boxShadow: "var(--shadow)" }}>
        <div style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: 12 }}>
          Adicionar Imagens
        </div>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 12, padding: "40px 20px", textAlign: "center", cursor: "pointer",
            transition: "all 0.2s", background: isDragging ? "var(--bg-drop-hover)" : "var(--bg-drop)",
          }}
        >
          <div style={{ color: "var(--accent)" }}><UploadIcon /></div>
          <p style={{ color: "var(--text-secondary)", fontSize: 16, marginTop: 12 }}>
            Arraste imagens aqui ou <span style={{ color: "var(--accent)", fontWeight: 600 }}>clique para selecionar</span>
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>WebP, AVIF, JPEG, PNG, BMP, TIFF, GIF</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_STRING}
          multiple
          style={{ display: "none" }}
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {/* File List */}
      {images.length > 0 && (
        <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", padding: 20, marginBottom: 16, boxShadow: "var(--shadow)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: 12 }}>
              {images.length} imagem{images.length !== 1 ? "s" : ""} selecionada{images.length !== 1 ? "s" : ""}
            </div>
            <button
              onClick={clearAll}
              disabled={isConverting}
              style={{
                background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "8px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6, transition: "all 0.2s",
              }}
            >
              Limpar tudo
            </button>
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {images.map((img) => (
              <div
                key={img.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                  borderRadius: 8, background: "var(--bg-input)", marginBottom: 6, transition: "all 0.2s",
                }}
              >
                <img src={img.preview} alt={img.name} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14, fontWeight: 500 }} title={img.name}>
                  {img.name}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: "var(--accent)" + "22", color: "var(--accent)", flexShrink: 0 }}>
                  {img.format}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>{formatSize(img.size)}</span>
                {img.status !== "pending" && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: statusColor(img.status) + "22", color: statusColor(img.status), flexShrink: 0 }}>
                    {statusLabel(img.status)}
                  </span>
                )}
                <button
                  onClick={() => removeImage(img.id)}
                  disabled={isConverting}
                  title="Remover"
                  style={{
                    background: "transparent", color: "var(--text-secondary)", border: "none",
                    borderRadius: 8, padding: "4px 6px", cursor: "pointer", display: "inline-flex",
                    alignItems: "center", transition: "all 0.2s",
                  }}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Options */}
      <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", padding: 20, marginBottom: 16, boxShadow: "var(--shadow)" }}>
        <div style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: 12 }}>
          Opcoes de Conversao
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Formato de destino
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              disabled={isConverting}
              style={{
                background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8,
                padding: "8px 12px", fontSize: 14, color: "var(--text-primary)", cursor: "pointer", minWidth: 120,
              }}
            >
              {OUTPUT_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Qualidade: {quality}%
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>10</span>
              <input type="range" min={10} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} disabled={isConverting} style={{ width: 140, accentColor: "var(--accent)" }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>100</span>
            </div>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              onClick={startConversion}
              disabled={isConverting || images.length === 0}
              style={{
                background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8,
                padding: "10px 24px", fontSize: 15, fontWeight: 500, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6, transition: "all 0.2s",
                opacity: isConverting || images.length === 0 ? 0.5 : 1,
              }}
            >
              <ZapIcon />
              {isConverting ? "Convertendo..." : "Converter"}
            </button>

            {convertedFiles.length > 0 && (
              <button
                onClick={downloadAll}
                style={{
                  background: "var(--success)", color: "#fff", border: "none", borderRadius: 8,
                  padding: "10px 24px", fontSize: 15, fontWeight: 500, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6, transition: "all 0.2s",
                }}
              >
                <DownloadIcon />
                Baixar {convertedFiles.length > 1 ? "ZIP" : ""}
              </button>
            )}
          </div>
        </div>

        {/* Progress */}
        {(isConverting || progress > 0) && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{isConverting ? "Processando..." : "Concluido"}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>{Math.round(progress)}%</span>
            </div>
            <div style={{ width: "100%", height: 8, borderRadius: 4, background: "var(--bg-input)", overflow: "hidden", marginTop: 8 }}>
              <div style={{ height: "100%", borderRadius: 4, background: "var(--accent)", transition: "width 0.3s", width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Log */}
      {logs.length > 0 && (
        <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", padding: 20, marginBottom: 16, boxShadow: "var(--shadow)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: 12 }}>
              Log de Conversao
            </div>
            <button
              onClick={() => setLogs([])}
              style={{
                background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "8px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6, transition: "all 0.2s",
              }}
            >
              Limpar
            </button>
          </div>
          <div style={{ maxHeight: 180, overflowY: "auto", fontFamily: "monospace", fontSize: 12, lineHeight: 1.8 }}>
            {logs.map((log) => (
              <div key={log.id} style={{ color: log.type === "success" ? "var(--success)" : log.type === "error" ? "var(--error)" : "var(--text-secondary)" }}>
                <span style={{ color: "var(--text-muted)" }}>[{log.time}]</span>{" "}
                {log.type === "success" ? "\u2714 " : log.type === "error" ? "\u2718 " : "\u25B6 "}
                {log.message}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "16px 0", color: "var(--text-muted)", fontSize: 12 }}>
        Conversor de Imagens em Massa &middot; WebP, AVIF, JPEG, PNG, BMP, TIFF
      </div>
    </div>
  );
}
