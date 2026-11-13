"use client";

import type { ReactNode, Ref } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, BriefcaseBusiness, Check, HeartHandshake, Sparkles } from 'lucide-react';

/** A finite celebration of answering, not a claim that course generation finished. */
export function ProfileCompletion({ name, headingRef, actions, review, reduceMotion = false }: {
  name: string;
  headingRef: Ref<HTMLHeadingElement>;
  actions: ReactNode;
  review: ReactNode;
  reduceMotion?: boolean;
}) {
  const t = useTranslations('enroll');
  return <div className={`profile-completion${reduceMotion ? ' is-reduced-motion' : ''}`}>
    <div className="profile-completion-art" aria-hidden="true">
      <svg className="profile-completion-orbits" viewBox="0 0 480 180" fill="none">
        <ellipse cx="240" cy="90" rx="164" ry="55" />
        <ellipse cx="240" cy="90" rx="105" ry="70" transform="rotate(-24 240 90)" />
        <path className="profile-completion-trace" d="M76 90C76 17 404 17 404 90S76 163 76 90" />
        <circle className="profile-completion-dot" cx="95" cy="64" r="4" />
        <circle className="profile-completion-dot" cx="368" cy="124" r="3" />
        <circle className="profile-completion-dot" cx="300" cy="27" r="3" />
      </svg>
      <span className="profile-completion-satellite is-context"><BriefcaseBusiness /></span>
      <span className="profile-completion-satellite is-learning"><BookOpen /></span>
      <span className="profile-completion-satellite is-support"><HeartHandshake /></span>
      <span className="profile-completion-seal"><Check strokeWidth={2.5} /></span>
      <Sparkles className="profile-completion-spark is-first" />
      <Sparkles className="profile-completion-spark is-second" />
    </div>
    <h1 ref={headingRef} tabIndex={-1} className="profile-question-title profile-completion-title">
      {name.trim() ? t('profileThanksNamed', { name: name.trim() }) : t('profileThanks')}
    </h1>
    <p className="profile-completion-message">{t('profilePersonalizationMessage')}</p>
    <div className="profile-completion-benefits">
      <div><BriefcaseBusiness aria-hidden="true" /><span>{t('profilePersonalizationContext')}</span></div>
      <div><BookOpen aria-hidden="true" /><span>{t('profilePersonalizationExplanations')}</span></div>
      <div><HeartHandshake aria-hidden="true" /><span>{t('profilePersonalizationSupport')}</span></div>
    </div>
    <div className="profile-completion-actions">{actions}</div>
    <p className="profile-completion-note">{t('profilePersonalizationNote')}</p>
    <details className="profile-completion-review">
      <summary>{t('profileReviewAnswers')}</summary>
      {review}
    </details>
  </div>;
}
