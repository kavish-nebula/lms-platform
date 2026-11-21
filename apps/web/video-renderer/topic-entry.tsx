import React from "react";
import { AbsoluteFill, Composition, Html5Audio, registerRoot, Sequence, Series, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import catalog from "../../../fixtures/videos-ai-agent.json";
import type { ConceptVideo, VideoSlide } from "../src/data/types";
import { TopicFilm } from "../src/components/player/video/topic-film";
import { sentenceStarts } from "../src/components/player/video/topic-storyboard";

const fps = 24;
const creditsFrames = fps * 4;
const topics = catalog.videos as ConceptVideo[];
type Props = { videoId: string; lengths: number[] };
const audioFile = (id: string, i: number) => staticFile(`audio/video-${id}-s${i}.mp3`);

function Scene({ slide, chapters, topic, index, count, length }: { slide: VideoSlide; chapters: VideoSlide[]; topic: string; index: number; count: number; length: number }) {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const starts = React.useMemo(() => sentenceStarts(slide.sentences.length ? slide.sentences : [slide.narration]), [slide]);
  return <TopicFilm chapters={chapters} slide={slide} topic={topic} position={index} count={count}
    fraction={frame / length} duration={length / config.fps} starts={starts} imageRoot={staticFile("topic-film")} />;
}

function TopicMovie({ videoId, lengths }: Props) {
  const video = topics.find(v => v.id === videoId)!;
  return <AbsoluteFill style={{ containerType: "inline-size", fontFamily: "Arial, sans-serif", background: "#12263b" }}>
    <Series>{video.slides.map((slide, i) => <Series.Sequence key={i} durationInFrames={lengths[i]!} premountFor={fps}>
      <Html5Audio src={audioFile(video.id, i)} />
      <Scene chapters={video.slides} slide={slide} topic={video.title} index={i} count={video.slides.length} length={lengths[i]!} />
    </Series.Sequence>)}</Series>
    <Sequence from={lengths.reduce((sum, n) => sum + n, 0)} durationInFrames={creditsFrames}>
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 9%", color: "#f4f8f6", fontSize: 34, lineHeight: 1.5 }}>
        <strong>Illustrations</strong>
        <span>Twemoji © Twitter, Inc. and other contributors</span>
        <span>CC BY 4.0 · creativecommons.org/licenses/by/4.0</span>
        <span>Original artwork animated for this lesson.</span>
      </AbsoluteFill>
    </Sequence>
  </AbsoluteFill>;
}

function Root() {
  return <>{topics.map(video => <Composition key={video.id} id={`Topic-${video.id}`} component={TopicMovie}
    width={1280} height={720} fps={fps} durationInFrames={fps}
    defaultProps={{ videoId: video.id, lengths: video.slides.map(() => fps) }}
    calculateMetadata={async ({ props }) => {
      const lengths = await Promise.all(video.slides.map(async (_, i) =>
        Math.max(1, Math.ceil(await getAudioDurationInSeconds(audioFile(video.id, i)) * fps))));
      return { props: { ...props, lengths }, durationInFrames: lengths.reduce((sum, n) => sum + n, creditsFrames) };
    }} />)}</>;
}
registerRoot(Root);
