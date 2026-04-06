import { redirect } from "next/navigation";

export default async function SpriteRedirect({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  redirect(`/sprites/${name}/detail`);
}
