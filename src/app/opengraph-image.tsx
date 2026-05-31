import { ImageResponse } from "next/og";
import { loadFreeMono } from "./fonts/load";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Sprites Dashboard";

const LINES = ["  __", "<(✦ )___", " (  ._>", "  `--´"];

export default async function OpenGraphImage() {
  const fontData = await loadFreeMono();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "black",
          color: "#fdc700",
          fontFamily: "FreeMono",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 96,
            fontWeight: 600,
            lineHeight: "96px",
            whiteSpace: "pre",
            letterSpacing: 0,
          }}
        >
          {LINES.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
        <div
          style={{
            marginTop: 56,
            fontSize: 56,
            fontWeight: 600,
            color: "white",
            letterSpacing: -1,
          }}
        >
          Sprites Dashboard
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "FreeMono", data: fontData, style: "normal", weight: 600 }],
    },
  );
}
