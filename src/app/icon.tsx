import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
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
          backgroundColor: "#000000",
          borderRadius: 32,
        }}
      >
        <span
          style={{
            fontSize: 280,
            fontWeight: 700,
            color: "#e4e4e7",
            fontFamily: "system-ui, sans-serif",
            lineHeight: 1,
          }}
        >
          N
        </span>
      </div>
    ),
    { ...size },
  );
}
