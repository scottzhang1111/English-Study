import { createContext, useContext } from 'react';

const LanguageContext = createContext({ language: 'ja' });

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  return (
    <LanguageContext.Provider value={{ language: 'ja' }}>
      {children}
    </LanguageContext.Provider>
  );
};
