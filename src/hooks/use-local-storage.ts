'use client';

import { useState, useEffect } from 'react';

function getValueFromLocalStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    const valueFromStorage = getValueFromLocalStorage<T>(key);
    return valueFromStorage !== null ? valueFromStorage : initialValue;
  });

  useEffect(() => {
    const valueFromStorage = getValueFromLocalStorage<T>(key);
    if (valueFromStorage !== null) {
      setStoredValue(valueFromStorage);
    }
  }, [key]);

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}
