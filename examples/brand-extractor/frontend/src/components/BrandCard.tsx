import { type FC, useState } from "react";
import type { BrandProgressData, BrandData, ColorTheme, StepStatus } from "../types/brand";

type Props = {
  data: BrandProgressData;
};

// Export format generators
const generateCSS = (brand: BrandData): string => {
  const lines = [
    `/* ${brand.companyName} Brand Colors */`,
    `/* Generated from ${brand.websiteUrl} */`,
    "",
    ":root {",
    "  /* Light Theme */",
  ];
  if (brand.lightTheme) {
    lines.push(
      `  --brand-light-primary: ${brand.lightTheme.primary};`,
      `  --brand-light-secondary: ${brand.lightTheme.secondary};`,
      `  --brand-light-accent: ${brand.lightTheme.accent};`,
      `  --brand-light-background: ${brand.lightTheme.background};`,
      `  --brand-light-text: ${brand.lightTheme.text};`,
    );
  }
  lines.push("", "  /* Dark Theme */");
  if (brand.darkTheme) {
    lines.push(
      `  --brand-dark-primary: ${brand.darkTheme.primary};`,
      `  --brand-dark-secondary: ${brand.darkTheme.secondary};`,
      `  --brand-dark-accent: ${brand.darkTheme.accent};`,
      `  --brand-dark-background: ${brand.darkTheme.background};`,
      `  --brand-dark-text: ${brand.darkTheme.text};`,
    );
  }
  lines.push("}");
  return lines.join("\n");
};

const generateJSON = (brand: BrandData): string => {
  return JSON.stringify({
    company: brand.companyName,
    website: brand.websiteUrl,
    logo: brand.logoUrl,
    defaultTheme: brand.defaultTheme,
    themes: {
      light: brand.lightTheme,
      dark: brand.darkTheme,
    },
  }, null, 2);
};

const generateTailwind = (brand: BrandData): string => {
  const lines = [
    `// ${brand.companyName} Brand Colors`,
    `// Generated from ${brand.websiteUrl}`,
    "",
    "module.exports = {",
    "  theme: {",
    "    extend: {",
    "      colors: {",
    "        brand: {",
  ];
  if (brand.lightTheme) {
    lines.push(
      "          light: {",
      `            primary: '${brand.lightTheme.primary}',`,
      `            secondary: '${brand.lightTheme.secondary}',`,
      `            accent: '${brand.lightTheme.accent}',`,
      `            background: '${brand.lightTheme.background}',`,
      `            text: '${brand.lightTheme.text}',`,
      "          },",
    );
  }
  if (brand.darkTheme) {
    lines.push(
      "          dark: {",
      `            primary: '${brand.darkTheme.primary}',`,
      `            secondary: '${brand.darkTheme.secondary}',`,
      `            accent: '${brand.darkTheme.accent}',`,
      `            background: '${brand.darkTheme.background}',`,
      `            text: '${brand.darkTheme.text}',`,
      "          },",
    );
  }
  lines.push(
    "        },",
    "      },",
    "    },",
    "  },",
    "};",
  );
  return lines.join("\n");
};

const downloadFile = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const StepIndicator: FC<{ status: StepStatus; label: string }> = ({
  status,
  label,
}) => {
  const getIcon = () => {
    switch (status) {
      case "done":
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" fill="#10b981" />
            <path
              d="M5 8L7 10L11 6"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "in_progress":
        return (
          <div className="brand-step-spinner">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle
                cx="8"
                cy="8"
                r="6"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray="28"
                strokeDashoffset="7"
              />
            </svg>
          </div>
        );
      case "error":
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" fill="#f59e0b" />
            <path
              d="M8 5V8M8 11H8.01"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        );
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="#d1d5db" strokeWidth="2" />
          </svg>
        );
    }
  };

  return (
    <div className="brand-step">
      {getIcon()}
      <span
        className={`brand-step-label ${status === "in_progress" ? "brand-step-active" : ""}`}
      >
        {label}
        {status === "in_progress" && "..."}
      </span>
    </div>
  );
};

const ColorSwatch: FC<{ color: string; label?: string; size?: "sm" | "md" }> = ({
  color,
  label,
  size = "md",
}) => {
  const [copied, setCopied] = useState(false);

  const handleClick = () => {
    navigator.clipboard.writeText(color);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={`brand-swatch brand-swatch-${size}`}
      onClick={handleClick}
      title={`${label ? label + ": " : ""}${color} (click to copy)`}
    >
      <div className="brand-swatch-color" style={{ backgroundColor: color }} />
      {size === "md" && (
        <span className="brand-swatch-hex">{copied ? "Copied!" : color}</span>
      )}
    </div>
  );
};

const ThemePreview: FC<{
  theme: ColorTheme;
  name: string;
  isDefault?: boolean;
}> = ({ theme, name, isDefault }) => {
  return (
    <div
      className={`brand-theme-preview ${isDefault ? "brand-theme-default" : ""}`}
    >
      <div className="brand-theme-header">
        <span className="brand-theme-name">{name}</span>
        {isDefault && <span className="brand-theme-badge">Default</span>}
      </div>
      <div className="brand-theme-colors">
        <ColorSwatch color={theme.primary} label="Primary" />
        <ColorSwatch color={theme.secondary} label="Secondary" />
        <ColorSwatch color={theme.accent} label="Accent" />
        <ColorSwatch color={theme.background} label="Background" />
        <ColorSwatch color={theme.text} label="Text" />
      </div>
    </div>
  );
};

const Skeleton: FC<{ width?: string; height?: string; className?: string }> = ({
  width = "100%",
  height = "1rem",
  className = "",
}) => (
  <div
    className={`brand-skeleton ${className}`}
    style={{ width, height }}
  />
);

// Copy/Download icons
const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ExportActions: FC<{ brandData: BrandData; companyName: string }> = ({ brandData, companyName }) => {
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const safeName = companyName.toLowerCase().replace(/[^a-z0-9]/g, "-");

  const handleCopy = (format: "css" | "json" | "tailwind") => {
    let content: string;
    switch (format) {
      case "css":
        content = generateCSS(brandData);
        break;
      case "json":
        content = generateJSON(brandData);
        break;
      case "tailwind":
        content = generateTailwind(brandData);
        break;
    }
    navigator.clipboard.writeText(content);
    setCopiedFormat(format);
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  const handleDownload = () => {
    const content = generateJSON(brandData);
    const filename = `${safeName}-brand.json`;
    downloadFile(content, filename, "application/json");
  };

  return (
    <div className="brand-export-actions">
      <div className="brand-export-row">
        <span className="brand-export-label">Copy:</span>
        <div className="brand-export-buttons">
          {(["css", "json", "tailwind"] as const).map((format) => (
            <button
              key={format}
              className={`brand-export-btn ${copiedFormat === format ? "brand-export-btn-copied" : ""}`}
              onClick={() => handleCopy(format)}
              title={`Copy as ${format.toUpperCase()}`}
            >
              {copiedFormat === format ? <CheckIcon /> : <CopyIcon />}
              <span>{format === "tailwind" ? "Tailwind" : format.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>
      <button
        className="brand-export-download-btn"
        onClick={handleDownload}
        title="Download as JSON file"
      >
        <DownloadIcon />
        <span>Download JSON</span>
      </button>
    </div>
  );
};

const BrandCard: FC<Props> = ({ data }) => {
  const { status, companyName, websiteUrl, steps, brandData } = data;
  const isComplete = status === "done";
  const hasError = status === "errored";
  const isCancelled = status === "cancelled";

  // Get step labels (order matches workflow: find website → logo → screenshots → colors)
  const stepLabels = [
    { key: "websiteSearch", label: "Finding website" },
    { key: "logoExtraction", label: "Extracting logo" },
    { key: "screenshot", label: "Taking screenshots" },
    { key: "colorExtraction", label: "Extracting colors" },
  ] as const;

  return (
    <div className={`brand-card ${isComplete ? "brand-card-complete" : ""}`}>
      {/* Header */}
      <div className="brand-card-header">
        <div className="brand-card-logo">
          {brandData?.logoUrl ? (
            <img src={brandData.logoUrl} alt={companyName} />
          ) : steps.logoExtraction.logoUrl ? (
            <img src={steps.logoExtraction.logoUrl} alt={companyName} />
          ) : (
            <div className="brand-card-logo-placeholder">
              {companyName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="brand-card-info">
          <h3 className="brand-card-company">{companyName}</h3>
          {(websiteUrl || steps.websiteSearch.url) && (
            <a
              href={websiteUrl || steps.websiteSearch.url}
              target="_blank"
              rel="noopener noreferrer"
              className="brand-card-url"
            >
              {new URL(websiteUrl || steps.websiteSearch.url || "").hostname}
            </a>
          )}
        </div>
        {isComplete && (
          <div className="brand-card-status-badge brand-card-status-done">
            Complete
          </div>
        )}
        {hasError && (
          <div className="brand-card-status-badge brand-card-status-error">
            Error
          </div>
        )}
        {isCancelled && (
          <div className="brand-card-status-badge brand-card-status-cancelled">
            Cancelled
          </div>
        )}
      </div>

      {/* Steps Progress */}
      {!isComplete && !hasError && !isCancelled && (
        <div className="brand-card-steps">
          {stepLabels.map(({ key, label }) => (
            <StepIndicator
              key={key}
              status={steps[key].status}
              label={label}
            />
          ))}
        </div>
      )}

      {/* Screenshot Preview */}
      <div className="brand-card-screenshot">
        {brandData?.screenshotUrl || steps.screenshot.imageUrl ? (
          <img
            src={brandData?.screenshotUrl || steps.screenshot.imageUrl}
            alt={`${companyName} website screenshot`}
          />
        ) : steps.screenshot.status === "in_progress" ||
          steps.websiteSearch.status === "in_progress" ? (
          <Skeleton height="180px" className="brand-screenshot-skeleton" />
        ) : null}
      </div>

      {/* Theme Results */}
      {isComplete && brandData?.lightTheme && brandData?.darkTheme && (
        <>
          <div className="brand-card-themes">
            <ThemePreview
              theme={brandData.lightTheme}
              name="Light Theme"
              isDefault={brandData.defaultTheme === "light"}
            />
            <ThemePreview
              theme={brandData.darkTheme}
              name="Dark Theme"
              isDefault={brandData.defaultTheme === "dark"}
            />
          </div>
          <ExportActions brandData={brandData} companyName={companyName} />
        </>
      )}

      {/* Loading state for themes */}
      {!isComplete && !hasError && !isCancelled && steps.colorExtraction.status === "in_progress" && (
        <div className="brand-card-themes-loading">
          <Skeleton height="120px" />
          <Skeleton height="120px" />
        </div>
      )}

      {/* Error message */}
      {hasError && data.error && (
        <div className="brand-card-error">
          <p>{data.error}</p>
        </div>
      )}
    </div>
  );
};

export default BrandCard;
