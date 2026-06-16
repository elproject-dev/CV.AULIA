import { useState, useEffect, useRef } from "react";

interface UseCountUpOptions {
  duration?: number;
  decimals?: number;
  startOnMount?: boolean;
  easing?: (t: number) => number;
}

const easeOutExpo = (t: number): number => {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
};

const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const easeOutQuart = (t: number): number => {
  return 1 - Math.pow(1 - t, 4);
};

export function useCountUp(
  endValue: number,
  options: UseCountUpOptions = {}
) {
  const {
    duration = 1500,
    decimals = 0,
    startOnMount = true,
    easing = easeOutExpo,
  } = options;

  const [displayValue, setDisplayValue] = useState(startOnMount ? 0 : endValue);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(0);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!startOnMount) {
      setDisplayValue(endValue);
      return;
    }

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);

      const currentValue =
        startValueRef.current +
        (endValue - startValueRef.current) * easedProgress;

      setDisplayValue(Number(currentValue.toFixed(decimals)));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        setIsAnimating(false);
        setIsComplete(true);
      }
    };

    startTimeRef.current = null;
    startValueRef.current = displayValue;
    setIsAnimating(true);
    setIsComplete(false);
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [endValue, duration, decimals, easing, startOnMount]);

  return { value: displayValue, isAnimating, isComplete };
}

export const countUpEasings = {
  expo: easeOutExpo,
  back: easeOutBack,
  quart: easeOutQuart,
};

export function useCountUpWithPulse(
  endValue: number,
  options: UseCountUpOptions = {}
) {
  const { value, isAnimating, isComplete } = useCountUp(endValue, options);
  const [showPulse, setShowPulse] = useState(false);

  useEffect(() => {
    if (isComplete) {
      setShowPulse(true);
      const timer = setTimeout(() => setShowPulse(false), 600);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isComplete]);

  return { value, isAnimating, isComplete, showPulse };
}
