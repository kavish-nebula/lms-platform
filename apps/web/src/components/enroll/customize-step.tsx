"use client";

import { useTranslations } from "next-intl";
import { ArrowRight, ChevronLeft, ListOrdered } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { Button } from "@/components/ui/button";
import { LessonOrderPreview } from "@/components/enroll/lesson-order-preview";
import type { LessonPart } from "@/lib/setup";

export type Pace = { sessionMinutes: number; studyDays: number[]; addToPlan: boolean };

export function CustomizeStep({ order, preference, primaryLabel, onBack, onEditProfile, onSubmit }: {
  order: LessonPart[];
  preference?: string | null;
  primaryLabel: string;
  onBack?: () => void;
  onEditProfile: () => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("enroll");

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
      <div className="flex min-w-0 flex-col gap-5">
        {onBack && (
          <Button type="button" variant="ghost" className="self-start" onClick={onBack}>
            <ChevronLeft aria-hidden data-icon="inline-start" />
            {t("backToQuickStart")}
          </Button>
        )}
        <header>
          <h1 tabIndex={-1} className="w-fit max-w-full text-3xl font-semibold tracking-tight text-balance md:text-4xl">{t("customizeTitle")}</h1>
          <p className="mt-2 max-w-[62ch] leading-relaxed text-ink-muted">{t("customizeBody")}</p>
        </header>

        <Surface as="section" aria-labelledby="lesson-sequence" className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
              <ListOrdered className="size-4" aria-hidden />
            </span>
            <h2 id="lesson-sequence" className="font-semibold">{t("cLessonOrder")}</h2>
          </div>
          <LessonOrderPreview order={order} preference={preference} />
        </Surface>
      </div>

      <Surface className="flex h-fit flex-col gap-2 lg:sticky lg:top-[calc(var(--nav-h)+32px)]">
        <Button type="button" size="lg" variant="brand" onClick={onSubmit}>
          {primaryLabel}
          <ArrowRight aria-hidden data-icon="inline-end" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onEditProfile}>
          {t("editProfileAnswers")}
        </Button>
      </Surface>
    </div>
  );
}
