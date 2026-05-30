import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

const LINES = ["  __", "<(✦ )___", " (  ._>", "  `--´"];

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          background: "black",
          color: "#fdc700",
          fontFamily:
            "ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
          fontSize: 11,
          fontWeight: 600,
          lineHeight: "11px",
          paddingLeft: 6,
          paddingTop: 2,
          whiteSpace: "pre",
          letterSpacing: 0,
        }}
      >
        {LINES.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    ),
    size,
  );
}
