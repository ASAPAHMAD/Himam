import { useState, useEffect } from 'react';
import { GoalSearchEntry, GoalSearchProvider } from '../onboarding/steps/goalSearch';

export function useGoalSearch(provider: GoalSearchProvider, query: string, debounceMs = 120) {
  const [results, setResults] = useState<GoalSearchEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [popularGoals, setPopularGoals] = useState<GoalSearchEntry[]>([]);

  useEffect(() => {
    let active = true;
    const loadPopular = async () => {
      try {
        const popular = await provider.getPopularGoals();
        if (active) setPopularGoals(popular);
      } catch (err) {
        console.error('Failed to load popular goals:', err);
      }
    };
    loadPopular();
    return () => {
      active = false;
    };
  }, [provider]);

  useEffect(() => {
    let active = true;

    if (query.trim().length === 0) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const runSearch = async () => {
      setIsSearching(true);
      try {
        const res = await provider.search(query);
        if (active) {
          setResults(res);
        }
      } catch (err) {
        console.error('Goal search hook error:', err);
      } finally {
        if (active) {
          setIsSearching(false);
        }
      }
    };

    const timeout = window.setTimeout(runSearch, debounceMs);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [provider, query, debounceMs]);

  return { results, isSearching, popularGoals };
}
