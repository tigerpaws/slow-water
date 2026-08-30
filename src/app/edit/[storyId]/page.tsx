import ExploreApp from "@/components/explore/ExploreApp";

export default async function EditPage({ params }: PageProps<"/edit/[storyId]">) {
  const { storyId } = await params;
  return <ExploreApp mode="edit" storyId={storyId} />;
}
