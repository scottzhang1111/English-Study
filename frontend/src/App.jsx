import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import HomePage from './pages/HomePage';
import AddChildPage from './pages/AddChildPage';
import ChildSelectPage from './pages/ChildSelectPage';
import DailyWordUnitPage from './pages/DailyWordUnitPage';
import FlashcardPage from './pages/FlashcardPage';
import QuizPage from './pages/QuizPage';
import VocabExpansionPage from './pages/VocabExpansionPage';
import GrammarPage from './pages/GrammarPage';
import GrammarFormPracticePage from './pages/GrammarFormPracticePage';
import AiPracticePage from './pages/AiPracticePage';
import EikenPage from './pages/EikenPage';
import EikenPre2PracticePage from './pages/EikenPre2PracticePage';
import EikenRealExamPage from './pages/EikenRealExamPage';
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
import CardCollectionPage from './pages/CardCollectionPage';
import CardRewardPage from './pages/CardRewardPage';
import StudyMapPage from './pages/StudyMapPage';
import WorldStagePage from './pages/WorldStagePage';
import SettingsPage from './pages/SettingsPage';
import ParentWordManagerPage from './pages/ParentWordManagerPage';
/* import BottomNav from './components/BottomNav'; */
import StartupGate, { RequireCurrentChild } from './components/StartupGate';
import { LanguageProvider } from './LanguageContext';
import { ChildrenProvider } from './ChildrenContext';
import { ThemeSchemeProvider } from './ThemeContext';

import { useLocation } from 'react-router-dom';

function RouteDebugBadge() {
  const location = useLocation();

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        left: 8,
        zIndex: 99999,
        padding: '6px 10px',
        borderRadius: 8,
        background: 'rgba(0,0,0,0.72)',
        color: '#00ffcc',
        fontSize: 12,
        fontWeight: 800,
        maxWidth: '90vw',
        wordBreak: 'break-all',
        pointerEvents: 'none',
      }}
    >
      {location.pathname}
      {location.search}
    </div>
  );
}

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

const STUDY_ROUTE_PREFIXES = [
  '/daily-words',
  '/app/daily-words',
  '/flashcard',
  '/app/flashcard',
  '/quiz',
  '/app/quiz',
  '/vocab-expansion',
  '/grammar-practice',
  '/ai-practice',
  '/battle',
  '/eiken',
  '/eiken-pre2',
  '/eiken-real',
  '/review',
  '/error-review',
  '/today-review-quiz',
  '/cards',
  '/card-reward',
  '/study-map',
  '/world-stage',
];

function isStudyRoute(pathname) {
  return STUDY_ROUTE_PREFIXES.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function App() {
  const location = useLocation();
  /* const hideBottomNav = isStudyRoute(location.pathname);
  const hideBottomNavOnMobile = location.pathname === '/grammar';
  const pageOwnsMobileStudyChrome = location.pathname === '/eiken-real';
  const isDashboardRoute = location.pathname === '/' || location.pathname === '/app'; */

  return (
    <ThemeSchemeProvider>
      <LanguageProvider>
        <ChildrenProvider>
          <div className="app-shell min-h-screen">
            <AnimatePresence mode="wait" initial={false}>
              <Routes location={location} key={location.pathname}>
            <Route path="/" element={<AnimatedPage><StartupGate /></AnimatedPage>} />
            <Route path="/app" element={<AnimatedPage><StartupGate /></AnimatedPage>} />
            <Route path="/select-child" element={<AnimatedPage><ChildSelectPage /></AnimatedPage>} />
            <Route path="/daily-words" element={<AnimatedPage><ChildRequiredPage><DailyWordUnitPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/app/daily-words" element={<AnimatedPage><ChildRequiredPage><DailyWordUnitPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/flashcard" element={<AnimatedPage><ChildRequiredPage><FlashcardPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/app/flashcard" element={<AnimatedPage><ChildRequiredPage><FlashcardPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/quiz" element={<AnimatedPage><ChildRequiredPage><QuizPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/app/quiz" element={<AnimatedPage><ChildRequiredPage><QuizPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/vocab-expansion" element={<AnimatedPage><ChildRequiredPage><VocabExpansionPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/grammar" element={<AnimatedPage><ChildRequiredPage><GrammarPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/grammar-practice" element={<AnimatedPage><ChildRequiredPage><GrammarFormPracticePage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/ai-practice" element={<AnimatedPage><AiPracticePage /></AnimatedPage>} />
            <Route path="/battle" element={<AnimatedPage><ChildRequiredPage><BattlePage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/eiken" element={<AnimatedPage><EikenPage /></AnimatedPage>} />
            <Route path="/eiken-pre2" element={<AnimatedPage><EikenPre2PracticePage /></AnimatedPage>} />
            <Route path="/eiken-real" element={<AnimatedPage><ChildRequiredPage><EikenRealExamPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/eiken-pre2/result/:attemptId" element={<AnimatedPage><EikenPre2ResultPage /></AnimatedPage>} />
            <Route path="/eiken-pre2/wrong-review" element={<AnimatedPage><EikenPre2WrongReviewPage /></AnimatedPage>} />
            <Route path="/review" element={<AnimatedPage><ChildRequiredPage><ReviewPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/error-review" element={<AnimatedPage><ChildRequiredPage><ReviewPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/today-review-quiz" element={<AnimatedPage><ChildRequiredPage><FlashcardPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/child-stats" element={<AnimatedPage><ChildRequiredPage><ChildStatsPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/learned-words" element={<AnimatedPage><ChildRequiredPage><LearnedWordsPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/hatch" element={<AnimatedPage><HatchPage /></AnimatedPage>} />
            <Route path="/cards" element={<AnimatedPage><ChildRequiredPage><CardCollectionPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/card-reward" element={<AnimatedPage><ChildRequiredPage><CardRewardPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/study-map" element={<AnimatedPage><ChildRequiredPage><StudyMapPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/world-stage" element={<AnimatedPage><ChildRequiredPage><WorldStagePage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/pokedex" element={<AnimatedPage><ChildRequiredPage><PokedexPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/pets" element={<AnimatedPage><ChildRequiredPage><PokedexPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/petroom" element={<AnimatedPage><ChildRequiredPage><PetRoomPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/pet" element={<AnimatedPage><ChildRequiredPage><PetRoomPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/petlevel" element={<AnimatedPage><ChildRequiredPage><PetLevelPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/progress" element={<AnimatedPage><ChildRequiredPage><ProgressPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/parent/word-manager" element={<AnimatedPage><ChildRequiredPage><ParentWordManagerPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/app/parent/word-manager" element={<AnimatedPage><ChildRequiredPage><ParentWordManagerPage /></ChildRequiredPage></AnimatedPage>} />
            <Route path="/settings" element={<AnimatedPage><SettingsPage /></AnimatedPage>} />
            <Route path="/settings/children" element={<AnimatedPage><SettingsPage /></AnimatedPage>} />
            <Route path="/settings/add-child" element={<AnimatedPage><AddChildPage /></AnimatedPage>} />
            <Route path="*" element={<Navigate replace to="/" />} />
             <RouteDebugBadge />
    {/* 你原来的 routes */}
              </Routes>
            </AnimatePresence>
{/*             {hideBottomNav ? (
              null
            ) : hideBottomNavOnMobile ? (
              <div className="max-md:hidden">
                <BottomNav />
              </div>
            ) : isDashboardRoute ? (
              <div className="hidden">
                <BottomNav />
              </div>
            ) : (
              <BottomNav />
            )} */}
          </div>
        </ChildrenProvider>
      </LanguageProvider>
    </ThemeSchemeProvider>
  );
}

export default App;
