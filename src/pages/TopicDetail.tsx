import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Users, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import EpisodePromptDialog from "@/components/EpisodePromptDialog";

type Episode = {
  id: string;
  episode_number: number;
  session_name: string | null;
  summary: string | null;
  characters: Array<{ name: string; description: string }>;
  created_at: string;
};

type Story = {
  id: string;
  topic: string;
  length: string;
  age: number;
  episode_count: number;
  story_summary: string | null;
};

type AggregatedCharacter = {
  name: string;
  description: string;
  episodes: number[];
};

const TopicDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [story, setStory] = useState<Story | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<AggregatedCharacter | null>(null);
  const [expandedEpisode, setExpandedEpisode] = useState<string | null>(null);
  const [showEpisodePrompt, setShowEpisodePrompt] = useState(false);

  useEffect(() => {
    if (!id) return;
    // Fetch story and episodes in parallel
    Promise.all([
      supabase.from("stories").select("*").eq("id", id).single(),
      supabase.from("story_episodes").select("*").eq("story_id", id).order("episode_number", { ascending: true }),
    ]).then(([storyRes, episodesRes]) => {
      if (storyRes.data) setStory(storyRes.data);
      if (episodesRes.data) {
        setEpisodes(
          episodesRes.data.map((ep: any) => ({
            ...ep,
            characters: Array.isArray(ep.characters) ? ep.characters : [],
          }))
        );
      }
    });
  }, [id]);

  // Aggregate characters across episodes
  const aggregatedCharacters: AggregatedCharacter[] = (() => {
    const map = new Map<string, AggregatedCharacter>();
    episodes.forEach((ep) => {
      ep.characters.forEach((c) => {
        const key = c.name.toLowerCase();
        if (map.has(key)) {
          const existing = map.get(key)!;
          if (!existing.episodes.includes(ep.episode_number)) {
            existing.episodes.push(ep.episode_number);
          }
          // Use latest description
          existing.description = c.description;
        } else {
          map.set(key, { name: c.name, description: c.description, episodes: [ep.episode_number] });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => b.episodes.length - a.episodes.length);
  })();

  const handlePlayNext = (episodeTheme?: string) => {
    if (!story) return;
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

  if (!story) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-md space-y-8"
      >
        {/* Header */}
        <div className="space-y-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div>
            <h1
              className="text-2xl font-semibold text-foreground"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              {story.topic}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {story.episode_count} episode{story.episode_count !== 1 ? "s" : ""} · Age {story.age}+
            </p>
          </div>
        </div>

        {/* Characters */}
        {aggregatedCharacters.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Characters</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {aggregatedCharacters.map((char) => (
                <button
                  key={char.name}
                  onClick={() => setSelectedCharacter(selectedCharacter?.name === char.name ? null : char)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all ${
                    selectedCharacter?.name === char.name
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-card text-secondary-foreground hover:border-primary/30"
                  }`}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px] bg-accent text-accent-foreground">
                      {char.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {char.name}
                </button>
              ))}
            </div>

            {/* Character detail */}
            <AnimatePresence>
              {selectedCharacter && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                    <p className="text-sm text-foreground">{selectedCharacter.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Appeared in episode{selectedCharacter.episodes.length > 1 ? "s" : ""}{" "}
                      {selectedCharacter.episodes.join(", ")}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Episodes */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Episodes</p>
          </div>

          {episodes.length === 0 ? (
            <p className="text-sm text-muted-foreground/60 italic">
              No episodes recorded yet. Play your first episode to get started!
            </p>
          ) : (
            <div className="space-y-2">
              {episodes.map((ep) => (
                <button
                  key={ep.id}
                  onClick={() => setExpandedEpisode(expandedEpisode === ep.id ? null : ep.id)}
                  className="w-full rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        Ep {ep.episode_number}: {ep.session_name || "Untitled"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(ep.created_at).toLocaleDateString()}
                        {ep.characters.length > 0 && ` · ${ep.characters.length} character${ep.characters.length > 1 ? "s" : ""}`}
                      </p>
                    </div>
                    {expandedEpisode === ep.id ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  <AnimatePresence>
                    {expandedEpisode === ep.id && ep.summary && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                          {ep.summary}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Play Next Episode */}
        <Button
          onClick={() => setShowEpisodePrompt(true)}
          size="lg"
          className="w-full rounded-xl bg-primary text-primary-foreground text-lg py-6 hover:bg-primary/90 transition-all"
        >
          <Play className="h-5 w-5 mr-2" />
          Play Next Episode
        </Button>
      </motion.div>

      <EpisodePromptDialog
        open={showEpisodePrompt}
        onOpenChange={setShowEpisodePrompt}
        onStart={(theme) => {
          setShowEpisodePrompt(false);
          handlePlayNext(theme);
        }}
        topicName={story.topic}
      />
    </div>
  );
};

export default TopicDetail;
