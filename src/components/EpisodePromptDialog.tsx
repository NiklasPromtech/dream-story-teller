import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Play } from "lucide-react";

type EpisodePromptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (theme?: string) => void;
  topicName: string;
};

const EpisodePromptDialog = ({ open, onOpenChange, onStart, topicName }: EpisodePromptDialogProps) => {
  const [theme, setTheme] = useState("");

  const handleStart = () => {
    onStart(theme.trim() || undefined);
    setTheme("");
  };

  const handleJustContinue = () => {
    onStart(undefined);
    setTheme("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle
            className="text-lg"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            Next episode of {topicName}
          </DialogTitle>
          <DialogDescription>
            Anything particular you want this episode to be about?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <Textarea
            placeholder="e.g., they go on a camping trip"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="bg-card border-border text-foreground placeholder:text-muted-foreground resize-none"
            rows={3}
          />

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleJustContinue}
            >
              Just continue
            </Button>
            <Button
              className="flex-1"
              onClick={handleStart}
              disabled={!theme.trim()}
            >
              <Play className="h-4 w-4 mr-1" />
              Start with theme
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EpisodePromptDialog;
