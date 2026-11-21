"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useCompanionStep } from "@/components/learning/course-companion";

export function TopicShort({ id, title, lessonTitle, children }: {
  id: string;
  title: string;
  lessonTitle: string;
  children: ReactNode;
}) {
  const [fullLesson, setFullLesson] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {fullLesson ? children : <Film id={id} title={title} lessonTitle={lessonTitle} onError={() => setFullLesson(true)} />}
      <Button
        className="self-start"
        variant={fullLesson ? "outline" : "brand"}
        onClick={() => setFullLesson(value => !value)}
      >
        {fullLesson ? "Watch the topic film" : "Open full lesson and knowledge checks"}
      </Button>
    </div>
  );
}

function Film({ id, title, lessonTitle, onError }: {
  id: string;
  title: string;
  lessonTitle: string;
  onError: () => void;
}) {
  const src = `/topic-shorts/${id}`;
  useCompanionStep({ title: lessonTitle, guidance: title, videoId: id });
  return (
    <div className="overflow-hidden rounded-card border border-line bg-panel">
      <video
        aria-label={title}
        className="aspect-video w-full bg-black"
        controls
        onError={onError}
        playsInline
        preload="metadata"
        src={`${src}.mp4`}
      >
        <track kind="captions" label="English" srcLang="en" src={`${src}.vtt`} default />
      </video>
    </div>
  );
}
