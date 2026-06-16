import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';

export type SlideDirection = 'left' | 'right' | 'none';

export function useSlideAnimation() {
  const [location] = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState<'enter' | 'entered' | 'exit'>('entered');
  const prevLocation = useRef(location);

  useEffect(() => {
    if (location === displayLocation) return;

    // Determine direction: if navigating forward (new page), slide left
    // If going back, slide right
    const direction: SlideDirection = 'left';
    setTransitionStage('enter');

    // Small delay to trigger animation
    const timer = setTimeout(() => {
      setDisplayLocation(location);
      prevLocation.current = location;

      // After enter animation completes
      setTimeout(() => {
        setTransitionStage('entered');
      }, 300);
    }, 10);

    return () => clearTimeout(timer);
  }, [location, displayLocation]);

  const animationClass = transitionStage === 'enter'
    ? 'animate-slide-enter'
    : transitionStage === 'exit'
      ? 'animate-slide-exit'
      : '';

  return {
    displayLocation,
    animationClass,
    transitionStage
  };
}