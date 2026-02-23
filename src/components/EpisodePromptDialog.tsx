import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Play } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

type EpisodePromptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (theme?: string, length?: string) => void;
  topicName: string;
  storyName?: string | null;
  currentLength?: string;
};

const DURATION_OPTIONS = [
  { value: "short", label: "Short", desc: "~3 min" },
  { value: "medium", label: "Medium", desc: "~7 min" },
  { value: "long", label: "Long", desc: "~15 min" },
];

const EpisodePromptDialog = ({ open, onOpenChange, onStart, topicName, storyName, currentLength }: EpisodePromptDialogProps) => {
  const [theme, setTheme] = useState("");
  const [selectedLength, setSelectedLength] = useState(currentLength || "medium");
  const isMobile = useIsMobile();

  const handleStart = () => {
    onStart(theme.trim() || undefined, selectedLength);
    setTheme("");
  };

  const handleJustContinue = () => {
    onStart(undefined, selectedLength);
    setTheme("");
  };

  const title = `Next episode of ${storyName || topicName}`;
  const description = "Anything particular you want this episode to be about?";

  const content = (
    <div className="space-y-4 pt-2 px-1">
      {/* Duration picker */}
      <div className="flex gap-2">
        {DURATION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelectedLength(opt.value)}
            className={`flex-1 rounded-lg border px-3 py-2.5 text-center transition-all ${
              selectedLength === opt.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/30"
            }`}
          >
            <span className="block text-sm font-medium">{opt.label}</span>
            <span className="block text-xs opacity-60">{opt.desc}</span>
          </button>
        ))}
      </div>

      <Textarea
        placeholder="e.g., they go on a camping trip"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        className="bg-card border-border text-foreground placeholder:text-muted-foreground resize-none text-base"
        rows={3}
      />

      <div className="flex gap-3 pb-safe">
        <Button
          variant="outline"
          className="flex-1 py-6 text-base active:scale-[0.98]"
          onClick={handleJustContinue}
        >
          Just continue
        </Button>
        <Button
          className="flex-1 py-6 text-base active:scale-[0.98]"
          onClick={handleStart}
          disabled={!theme.trim()}
        >
          <Play className="h-4 w-4 mr-1" />
          With theme
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle style={{ fontFamily: "'Crimson Pro', serif" }}>
              {title}
            </DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle
            className="text-lg"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};

export default EpisodePromptDialog;
