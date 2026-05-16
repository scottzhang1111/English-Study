import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import HomePage from './pages/HomePage';
import AddChildPage from './pages/AddChildPage';
import ChildSelectPage from './pages/ChildSelectPage';
import DailyWordUnitPage from './pages/DailyWordUnitPage';
import FlashcardPage from './pages/FlashcardPage';
import QuizPage from './pages/QuizPage';
import VocabExpansionPage from './pages/VocabExpansionPage';
import AiPracticePage from './pages/AiPracticePage';
import EikenPage from './pages/EikenPage';
import EikenPre2PracticePage from './pages/EikenPre2PracticePage';
import EikenPre2ResultPage from './pages/EikenPre2ResultPage';
import EikenPre2WrongReviewPage from './pages/EikenPre2WrongReviewPage';
import BattlePage from './pages/BattlePage';
import ReviewPage from './pages/ReviewPage';
import ChildStatsPage from './pages/ChildStatsPage';
import LearnedWordsPage from './pages/LearnedWordsPage';
import HatchPage from './pages/HatchPage';
import PokedexPage from './pages/PokedexPage';
import PetRoomPage from './pages/PetRoomPage';
import PetLevelPage from './pages/PetLevelPage';
import ProgressPage from './pages/ProgressPage';
import SettingsPage from './pages/SettingsPage';
import BottomNav from './components/BottomNav';
import StartupGate, { RequireCurrentChild } from './components/StartupGate';
import { LanguageProvider } from './LanguageContext';

function AnimatedPage({ children }) {
  return (
    <motion.div
      key="page"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
      className="page-wrap min-h-screen pb-28"
    >
      {children}
    </motion.div>
  );
}

function ChildRequiredPage({ children }) {
  return <RequireCurrentChild>{children}</RequireCurrentChild>;
}

function App() {
  const location = useLocation();

  return (
    <LanguageProvider>
      <div className="app-shell min-h-screen text-slate-900">
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<AnimatedPage><StartupGate /></AnimatedPage>} />
            <Route path="/app" element={<AnimatedPage><StartupGate /></AnimatedPage>} />
            <Route path="/select-child" element={<AnimatedPage><ChildSelectPage /></AnimatedPage>} />
            <Route path="/daily-words" element={<AnimatedPage><ChildRequiredPage><DailyWordUnitPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/app/daily-words" element={<AnimatedPage><ChildRequiredPage><DailyWordUnitPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/flashcard" element={<AnimatedPage><ChildRequiredPage><FlashcardPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/quiz" element={<AnimatedPage><ChildRequiredPage><QuizPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/vocab-expansion" element={<AnimatedPage><VocabExpansionPage /></AnimatedPage>} />
            <Route path="/ai-practice" element={<AnimatedPage><AiPracticePage /></AnimatedPage>} />
            <Route path="/battle" element={<AnimatedPage><ChildRequiredPage><BattlePage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/eiken" element={<AnimatedPage><EikenPage /></AnimatedPage>} />
            <Route path="/eiken-pre2" element={<AnimatedPage><EikenPre2PracticePage /></AnimatedPage>} />
            <Route path="/eiken-pre2/result/:attemptId" element={<AnimatedPage><EikenPre2ResultPage /></AnimatedPage>} />
            <Route path="/eiken-pre2/wrong-review" element={<AnimatedPage><EikenPre2WrongReviewPage /></AnimatedPage>} />
            <Route path="/review" element={<AnimatedPage><ChildRequiredPage><ReviewPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/error-review" element={<AnimatedPage><ChildRequiredPage><ReviewPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/today-review-quiz" element={<AnimatedPage><ChildRequiredPage><FlashcardPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/child-stats" element={<AnimatedPage><ChildRequiredPage><ChildStatsPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/learned-words" element={<AnimatedPage><ChildRequiredPage><LearnedWordsPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/hatch" element={<AnimatedPage><HatchPage /></AnimatedPage>} />
            <Route path="/pokedex" element={<AnimatedPage><ChildRequiredPage><PokedexPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/pokemon" element={<AnimatedPage><ChildRequiredPage><PokedexPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/petroom" element={<AnimatedPage><ChildRequiredPage><PetRoomPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/pet" element={<AnimatedPage><ChildRequiredPage><PetRoomPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/petlevel" element={<AnimatedPage><ChildRequiredPage><PetLevelPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/progress" element={<AnimatedPage><ChildRequiredPage><ProgressPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/settings" element={<AnimatedPage><SettingsPage /></AnimatedPage>} />
            <Route path="/settings/children" element={<AnimatedPage><SettingsPage /></AnimatedPage>} />
            <Route path="/settings/add-child" element={<AnimatedPage><AddChildPage /></AnimatedPage>} />
            <Route path="*" element={<Navigate replace to="/" />} />
          </Routes>
        </AnimatePresence>
        <BottomNav />
      </div>
    </LanguageProvider>
  );
}

export default App;
