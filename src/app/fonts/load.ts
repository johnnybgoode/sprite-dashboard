import { readFile } from "node:fs/promises";
import path from "node:path";

const FONT_PATH = path.join(process.cwd(), "src/app/fonts/FreeMono.ttf");

export async function loadFreeMono(): Promise<Buffer> {
  return readFile(FONT_PATH);
}
