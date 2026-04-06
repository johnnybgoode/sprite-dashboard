import { SpritesClient } from "@fly/sprites";

export function getClient() {
  return new SpritesClient(process.env.SPRITES_API_TOKEN!);
}

export function getSprite(name: string) {
  return getClient().getSprite(name);
}
