import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CompleteOnboardingResponse,
  OnboardingAnswers,
  OnboardingState,
  OnboardingStep,
} from '@second-brain/shared';
import { api } from '../client';
import { stepsFor } from './catalog';

type Section = keyof OnboardingAnswers;

/**
 * The onboarding state machine (UI/UX Sprint 2).
 *
 * Loads the saved state on mount so an interrupted KYC RESUMES where it stopped
 * (2.20), keeps a local draft the steps edit, and PERSISTS progressively on every
 * advance (2.18 — nothing is lost if the learner closes the app). The step order
 * is ADAPTIVE (2, "parcours adaptatif"): it recomputes from the chosen category
 * so a language learner never sees the university questions.
 */
export function useOnboarding() {
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedStep = useRef<OnboardingStep>('welcome');

  const steps = useMemo(() => stepsFor(answers), [answers]);
  const step = steps[Math.min(stepIndex, steps.length - 1)];

  // Resume: load the saved state and jump to the last step reached.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const state = await api<OnboardingState>('/onboarding');
        if (cancelled) return;
        setAnswers(state.answers ?? {});
        loadedStep.current = state.currentStep;
      } catch {
        // A fresh/unreachable state just starts at the beginning.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Once answers are loaded, resolve the resume step against the adaptive order.
  useEffect(() => {
    if (loading) return;
    const idx = stepsFor(answers).indexOf(loadedStep.current);
    if (idx > 0) setStepIndex(idx);
    // Only on first load — subsequent navigation is manual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const patch = useCallback((section: Section, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [section]: value }));
  }, []);

  /** Merge fields into an object section (identity/education/…). */
  const patchField = useCallback(
    (section: Section, fields: Record<string, unknown>) => {
      setAnswers((prev) => ({
        ...prev,
        [section]: { ...((prev[section] as object) ?? {}), ...fields },
      }));
    },
    [],
  );

  const persist = useCallback(
    async (nextStep: OnboardingStep, current: OnboardingAnswers) => {
      setSaving(true);
      setError(null);
      try {
        await api<OnboardingState>('/onboarding', {
          method: 'PUT',
          body: { currentStep: nextStep, answers: current },
        });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const next = useCallback(() => {
    const order = stepsFor(answers);
    const i = order.indexOf(step);
    const nextStep = order[Math.min(i + 1, order.length - 1)];
    void persist(nextStep, answers);
    setStepIndex(order.indexOf(nextStep));
  }, [answers, step, persist]);

  const back = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const goTo = useCallback(
    (target: OnboardingStep) => {
      const order = stepsFor(answers);
      const idx = order.indexOf(target);
      if (idx >= 0) setStepIndex(idx);
    },
    [answers],
  );

  const complete =
    useCallback(async (): Promise<CompleteOnboardingResponse> => {
      setSaving(true);
      setError(null);
      try {
        // Save the final answers first, then let the server build the config.
        await api<OnboardingState>('/onboarding', {
          method: 'PUT',
          body: { currentStep: 'twin', answers },
        });
        return await api<CompleteOnboardingResponse>('/onboarding/complete', {
          method: 'POST',
        });
      } finally {
        setSaving(false);
      }
    }, [answers]);

  return {
    answers,
    steps,
    step,
    stepIndex,
    total: steps.length,
    loading,
    saving,
    error,
    patch,
    patchField,
    next,
    back,
    goTo,
    complete,
    setAnswers,
  };
}

export type OnboardingController = ReturnType<typeof useOnboarding>;
