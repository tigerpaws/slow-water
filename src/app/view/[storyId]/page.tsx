import StoryPlayer from "@/components/view/StoryPlayer";

export default async function ViewPage({ params }: PageProps<"/view/[storyId]">) {
  const { storyId } = await params;
  return <StoryPlayer storyId={storyId} />;
}
