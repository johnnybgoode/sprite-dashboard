import { ImageResponse } from "next/og";
import { loadFreeMono } from "./fonts/load";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const LINES = ["  __", "<(✦ )___", " (  ._>", "  `--´"];

export default async function AppleIcon() {
  const fontData = await loadFreeMono();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "black",
          color: "#fdc700",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontFamily: "FreeMono",
            fontSize: 34,
            fontWeight: 600,
            lineHeight: "34px",
            whiteSpace: "pre",
            letterSpacing: 0,
          }}
        >
          {LINES.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "FreeMono", data: fontData, style: "normal", weight: 600 }],
    },
  );
}
