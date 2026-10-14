import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Locale } from '../shared/model';
import { translate } from '../shared/localization';
const Context = createContext({
  locale: 'en' as Locale,
  setLocale: (_v: Locale) => {},
  t: (v: string | number) => String(v),
});
export function LanguageProvider({ children, fixed }: { children: ReactNode; fixed?: Locale }) {
  const [chosen, setChosen] = useState<Locale>(() =>
    localStorage.getItem('cortex-language') === 'uk' ? 'uk' : 'en',
  );
  const locale = fixed || chosen;
  const setLocale = useCallback(
    (value: Locale) => {
      if (fixed) return;
      localStorage.setItem('cortex-language', value);
      setChosen(value);
    },
    [fixed],
  );
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = locale;
    document.title =
      locale === 'uk' ? 'CORTEX — Лабораторія продуктивності' : 'CORTEX — Performance Laboratory';
    return () => {
      document.documentElement.lang = previous;
    };
  }, [locale]);
  return (
    <Context.Provider
      value={{ locale, setLocale, t: (value: string | number) => translate(String(value), locale) }}
    >
      {children}
    </Context.Provider>
  );
}
export const useLanguage = () => useContext(Context);
