'use client';

import { useState, useCallback } from 'react';

export type ValidationRule = {
  required?: boolean | string;
  minLength?: [number, string];
  maxLength?: [number, string];
  pattern?: [RegExp, string];
  validate?: (value: string) => string | null;
};

export type ValidationRules<T extends Record<string, string>> = Partial<Record<keyof T, ValidationRule>>;

export function useFormValidation<T extends Record<string, string>>(rules: ValidationRules<T>) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateField = useCallback((name: keyof T, value: string): string | null => {
    const rule = rules[name];
    if (!rule) return null;
    if (rule.required) {
      const msg = typeof rule.required === 'string' ? rule.required : `${String(name)} is required`;
      if (!value.trim()) return msg;
    }
    if (rule.minLength && value.length < rule.minLength[0]) return rule.minLength[1];
    if (rule.maxLength && value.length > rule.maxLength[0]) return rule.maxLength[1];
    if (rule.pattern && !rule.pattern[0].test(value)) return rule.pattern[1];
    if (rule.validate) return rule.validate(value);
    return null;
  }, [rules]);

  const setFieldError = useCallback((name: string, message: string) => {
    setErrors(prev => ({ ...prev, [name]: message }));
  }, []);

  const clearFieldError = useCallback((name: string) => {
    setErrors(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const handleBlur = useCallback((name: keyof T, value: string) => {
    const error = validateField(name, value);
    setErrors(prev => {
      const next = { ...prev };
      if (error) next[name as string] = error;
      else delete next[name as string];
      return next;
    });
  }, [validateField]);

  const handleChange = useCallback((name: keyof T, value: string) => {
    if (errors[name as string]) {
      const error = validateField(name, value);
      setErrors(prev => {
        const next = { ...prev };
        if (error) next[name as string] = error;
        else delete next[name as string];
        return next;
      });
    }
  }, [errors, validateField]);

  const validateAll = useCallback((data: T): boolean => {
    const newErrors: Record<string, string> = {};
    let valid = true;
    for (const key of Object.keys(rules) as (keyof T)[]) {
      const error = validateField(key, data[key] || '');
      if (error) { newErrors[key as string] = error; valid = false; }
    }
    setErrors(newErrors);
    return valid;
  }, [rules, validateField]);

  const clearAll = useCallback(() => setErrors({}), []);

  return { errors, setFieldError, clearFieldError, handleBlur, handleChange, validateAll, clearAll };
}

export function InputError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="text-xs text-red-500 mt-1">{error}</p>;
}
