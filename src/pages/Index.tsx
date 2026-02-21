import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Moon, Rocket, Fish, Sparkles, TreePine, Castle, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import EpisodePromptDialog from "@/components/EpisodePromptDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TOPICS = [
  { label: "Space adventure", icon: Rocket },
  { label: "Underwater kingdom", icon: Fish },
  { label: "Enchanted forest", icon: TreePine },
  { label: "Dragon tales", icon: Sparkles },
  { label: "Castle quest", icon: Castle },
];

const LENGTHS = [
  { label: "Short", minutes: "~3 min", value: "short" },
  { label: "Medium", minutes: "~7 min", value: "medium" },
  { label: "Long", minutes: "~15 min", value: "long" },
];

const AGES = [
  { label: "2–3", value: 2 },
  { label: "4–5", value: 4 },
  { label: "6–8", value: 6 },
  { label: "9–12", value: 9 },
];

type Story = {
  id: string;
  topic: string;
  length: string;
  age: number;
  episode_count: number;
  last_played_at: string;
  story_summary: string | null;
  story_name: string | null;
  story_description: string | null;
};

type GroupedStory = {
  topic: string;
  totalEpisodes: number;
  latestStory: Story;
  storyCount: number;
  allIds: string[];
};

function groupStoriesByTopic(stories: Story[]): GroupedStory[] {
  const map = new Map<string, Story[]>();
  stories.forEach((s) => {
    const key = s.topic.toLowerCase().trim();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  });
  const groups: GroupedStory[] = [];
  map.forEach((items) => {
    items.sort((a, b) => new Date(b.last_played_at).getTime() - new Date(a.last_played_at).getTime());
    groups.push({
      topic: items[0].topic,
      totalEpisodes: items.reduce((sum, s) => sum + s.episode_count, 0),
      latestStory: items[0],
      storyCount: items.length,
      allIds: items.map((s) => s.id),
    });
  });
  groups.sort((a, b) => new Date(b.latestStory.last_played_at).getTime() - new Date(a.latestStory.last_played_at).getTime());
  return groups;
}

const Index = () => {
  const navigate = useNavigate();
  const [selectedTopic, setSelectedTopic] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [selectedLength, setSelectedLength] = useState("medium");
  const [selectedAge, setSelectedAge] = useState(4);
  const [pastStories, setPastStories] = useState<Story[]>([]);
  const [promptStory, setPromptStory] = useState<Story | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<GroupedStory | null>(null);

  const topic = customTopic || selectedTopic;

  const fetchStories = () => {
    supabase
      .from("stories")
      .select("*")
      .order("last_played_at", { ascending: false })
      .then(({ data }) => {
        if (data) setPastStories(data);
      });
  };

  useEffect(() => {
    fetchStories();
  }, []);

  const groupedStories = groupStoriesByTopic(pastStories);

  const handleStart = () => {
    if (!topic) return;
    navigate("/story", { state: { topic, length: selectedLength, age: selectedAge, isNew: true } });
  };

  const handleContinue = (story: Story, episodeTheme?: string) => {
    navigate("/story", {
      state: {
        topic: story.topic,
        length: story.length,
        age: story.age,
        storyId: story.id,
        episodeCount: story.episode_count,
        isNew: false,
        previousSummary: story.story_summary || "",
        episodeTheme,
      },
    });
  };

  const handleDelete = async (group: GroupedStory) => {
    for (const id of group.allIds) {
      await supabase.from("stories").delete().eq("id", id);
    }
    setDeleteGroup(null);
    fetchStories();
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-md space-y-10"
      >
        {/* Header */}
        <div className="text-center space-y-3 pt-8">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="inline-block"
          >
            <Moon className="h-12 w-12 text-primary mx-auto" />
          </motion.div>
          <h1
            className="text-3xl font-semibold tracking-tight text-foreground"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            Bedtime Stories
          </h1>
          <p className="text-muted-foreground text-sm">
            Pick a story and let the magic begin
          </p>
        </div>

        {/* Continue past stories (grouped) */}
        {groupedStories.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Continue a story
            </p>
            <div className="space-y-2">
              {groupedStories.map((group) => (
                <div key={group.latestStory.id} className="flex w-full items-center gap-2">
                  <button
                    onClick={() => navigate(`/topic/${group.latestStory.id}`)}
                    className="flex flex-1 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-secondary-foreground transition-all hover:border-primary/30 hover:bg-card/80"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{group.latestStory.story_name || group.topic}</p>
                      {group.latestStory.story_description && (
                        <p className="text-xs text-muted-foreground truncate">{group.latestStory.story_description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {group.totalEpisodes} episode{group.totalEpisodes !== 1 ? "s" : ""} · {group.latestStory.length} · age {group.latestStory.age}+
                        {group.storyCount > 1 && (
                          <span className="text-primary/70"> · {group.storyCount} series</span>
                        )}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => setPromptStory(group.latestStory)}
                    className="flex h-full items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-3 py-3 text-primary transition-all hover:bg-primary/20"
                    title="Play next episode"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteGroup(group)}
                    className="flex h-full items-center justify-center rounded-xl border border-border px-3 py-3 text-muted-foreground transition-all hover:border-destructive/30 hover:text-destructive hover:bg-destructive/10"
                    title="Delete story"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Topic Cards */}
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {groupedStories.length > 0 ? "Or start a new story" : "Choose a theme"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {TOPICS.map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => { setSelectedTopic(label); setCustomTopic(""); }}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all
                  ${selectedTopic === label && !customTopic
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-card text-secondary-foreground hover:border-primary/30 hover:bg-card/80"
                  }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </div>
          <Input
            placeholder="Or type your own idea…"
            value={customTopic}
            onChange={(e) => { setCustomTopic(e.target.value); setSelectedTopic(""); }}
            className="bg-card border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Age Selector */}
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Child's age</p>
          <div className="flex gap-3">
            {AGES.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setSelectedAge(value)}
                className={`flex-1 rounded-xl border py-3 text-center transition-all
                  ${selectedAge === value
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-card text-secondary-foreground hover:border-primary/30"
                  }`}
              >
                <div className="text-sm font-medium">{label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Length Selector */}
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Story length</p>
          <div className="flex gap-3">
            {LENGTHS.map(({ label, minutes, value }) => (
              <button
                key={value}
                onClick={() => setSelectedLength(value)}
                className={`flex-1 rounded-xl border py-3 text-center transition-all
                  ${selectedLength === value
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-card text-secondary-foreground hover:border-primary/30"
                  }`}
              >
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{minutes}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <Button
          onClick={handleStart}
          disabled={!topic}
          size="lg"
          className="w-full rounded-xl bg-primary text-primary-foreground text-lg py-6 hover:bg-primary/90 disabled:opacity-30 transition-all"
        >
          Start Story
        </Button>
      </motion.div>

      {/* Episode Prompt Dialog */}
      <EpisodePromptDialog
        open={!!promptStory}
        onOpenChange={(open) => !open && setPromptStory(null)}
        onStart={(theme) => {
          if (promptStory) handleContinue(promptStory, theme);
          setPromptStory(null);
        }}
        topicName={promptStory?.topic || ""}
        storyName={promptStory?.story_name}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteGroup} onOpenChange={(open) => !open && setDeleteGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteGroup?.topic}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteGroup?.storyCount === 1 ? "this story" : `all ${deleteGroup?.storyCount} series`} and {deleteGroup?.totalEpisodes} episode{deleteGroup?.totalEpisodes !== 1 ? "s" : ""}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteGroup && handleDelete(deleteGroup)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;
