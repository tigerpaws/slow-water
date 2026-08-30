import ExploreApp from "@/components/explore/ExploreApp";

export default async function ExplorePage({ params }: PageProps<"/explore/[siteId]">) {
  const { siteId } = await params;
  return <ExploreApp mode="explore" siteId={siteId} />;
}
