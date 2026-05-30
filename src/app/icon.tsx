import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "black",
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="13" cy="14" r="8" fill="#ffd400" />
          <circle cx="15" cy="12" r="1.6" fill="#000" />
          <path d="M21 14 L29 13 L29 16 L21 16 Z" fill="#ff8a00" />
          <path d="M5 21 Q9 19 13 21 L13 23 Q9 22 5 23 Z" fill="#ffd400" />
        </svg>
      </div>
    ),
    size,
  );
}
