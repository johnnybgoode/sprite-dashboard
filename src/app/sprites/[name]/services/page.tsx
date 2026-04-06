import { listServices } from "@/lib/sprites";
import { ServiceTable } from "@/components/services/service-table";

export const dynamic = "force-dynamic";

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const services = await listServices(name);

  return <ServiceTable spriteName={name} services={services} />;
}
