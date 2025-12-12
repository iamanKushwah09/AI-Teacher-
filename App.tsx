import React, { useState, useEffect, useCallback } from 'react';
import { useGeminiLive } from './hooks/useGeminiLive';
import { ConnectionState, UserProgress } from './types';
import Visualizer from './components/Visualizer';
import { Mic, Power, GraduationCap, PlayCircle, Loader2, Star, BookOpen } from 'lucide-react';

const STORAGE_KEY = 'mimi_user_progress_v1';

const DEFAULT_PROGRESS: UserProgress = {
    difficulty: 'Easy',
    stars: 0,
    completedTopics: []
};

// Define topics available per difficulty
const TOPICS_BY_DIFFICULTY: Record<string, string[]> = {
    'Easy': ['Colors', 'Animals', 'Numbers', 'Fruits'],
    'Medium': ['Shapes', 'Math', 'Weather', 'Days'],
    'Hard': ['Science', 'Geography', 'Time', 'Space']
};

const App: React.FC = () => {
  const [progress, setProgress] = useState<UserProgress>(DEFAULT_PROGRESS);
  const [selectedTopic, setSelectedTopic] = useState<string | undefined>(undefined);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Load progress on mount
  useEffect(() => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
          try {
              setProgress(JSON.parse(saved));
          } catch (e) {
              console.error("Failed to load progress", e);
          }
      }
      setHasLoaded(true);
  }, []);

  // Save progress whenever it changes (debounced slightly by nature of React updates)
  useEffect(() => {
      if (hasLoaded) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      }
  }, [progress, hasLoaded]);

  // Callback to handle evaluation from AI
  const handleEvaluation = useCallback((isCorrect: boolean, topic?: string) => {
      if (isCorrect) {
          setProgress(prev => {
              const newTopics = topic && !prev.completedTopics.includes(topic) 
                  ? [...prev.completedTopics, topic] 
                  : prev.completedTopics;
              
              return {
                  ...prev,
                  stars: prev.stars + 1,
                  completedTopics: newTopics
              };
          });
      }
  }, []);

  const { connectionState, connect, disconnect, isMimiSpeaking, volume } = useGeminiLive({
      onEvaluation: handleEvaluation
  });

  const handleStart = () => {
    connect(progress.difficulty, selectedTopic);
  };

  const handleStop = () => {
    disconnect();
  };

  const handleDifficultyChange = (level: string) => {
      setProgress(prev => ({ ...prev, difficulty: level }));
      setSelectedTopic(undefined); // Reset topic when difficulty changes
  };

  const toggleTopic = (topic: string) => {
      if (selectedTopic === topic) {
          setSelectedTopic(undefined);
      } else {
          setSelectedTopic(topic);
      }
  };

  // Prevent flash of default state before loading
  if (!hasLoaded) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-indigo-50 flex flex-col items-center p-4 overflow-hidden relative">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-10 left-10 w-20 h-20 bg-yellow-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div className="absolute top-10 right-10 w-20 h-20 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-32 h-32 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>

      {/* Header */}
      <header className="w-full max-w-md flex items-center justify-between z-10 mb-4 mt-2">
        <div className="flex items-center space-x-2">
            <div className="bg-indigo-500 p-2 rounded-lg text-white">
                <GraduationCap size={24} />
            </div>
            <h1 className="text-2xl font-bold text-indigo-900 tracking-tight">Mimi</h1>
        </div>
        
        {/* Star Counter */}
        <div className="bg-white/60 px-4 py-1.5 rounded-full flex items-center space-x-2 border border-white/50 shadow-sm">
            <Star size={18} className="text-yellow-400 fill-yellow-400" />
            <span className="font-bold text-indigo-900">{progress.stars}</span>
        </div>

        <div className={`px-3 py-1 rounded-full text-xs font-bold ${connectionState === ConnectionState.CONNECTED ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
          {connectionState === ConnectionState.CONNECTED ? 'ONLINE' : 'OFFLINE'}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-md flex flex-col items-center justify-center relative z-10">
        
        {/* Intro Card (Only when disconnected) */}
        {connectionState === ConnectionState.DISCONNECTED && (
          <div className="bg-white/80 backdrop-blur-sm p-6 sm:p-8 rounded-3xl shadow-xl text-center border-2 border-white w-full">
            <div className="mb-4 flex justify-center">
                <div className="w-28 h-28 bg-sky-100 rounded-full flex items-center justify-center relative">
                   <img 
                    src="https://picsum.photos/200/200?random=1" 
                    alt="Mimi Placeholder" 
                    className="w-24 h-24 rounded-full object-cover border-4 border-white"
                   />
                </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Hi! I'm Mimi.</h2>
            <p className="text-gray-600 mb-6 leading-relaxed text-sm sm:text-base">
              Welcome back! You have <b>{progress.stars} stars</b>. <br/> What do you want to learn?
            </p>

            {/* Difficulty Selector */}
            <div className="mb-4">
                <label className="block text-indigo-800 text-xs font-bold mb-2 uppercase tracking-wide">Age Level</label>
                <div className="grid grid-cols-3 gap-2">
                    {['Easy', 'Medium', 'Hard'].map((level) => (
                        <button
                            key={level}
                            onClick={() => handleDifficultyChange(level)}
                            className={`py-2 px-1 rounded-xl text-sm font-bold transition-all duration-200 border-2 ${
                                progress.difficulty === level 
                                ? 'bg-indigo-500 text-white border-indigo-500 shadow-md transform scale-105' 
                                : 'bg-white text-indigo-400 border-indigo-100 hover:border-indigo-300'
                            }`}
                        >
                            {level}
                        </button>
                    ))}
                </div>
            </div>

            {/* Topic Selector */}
            <div className="mb-8">
                 <label className="block text-indigo-800 text-xs font-bold mb-2 uppercase tracking-wide">Choose a Topic (Optional)</label>
                 <div className="flex flex-wrap gap-2 justify-center">
                    {TOPICS_BY_DIFFICULTY[progress.difficulty]?.map(topic => (
                        <button
                            key={topic}
                            onClick={() => toggleTopic(topic)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                selectedTopic === topic 
                                ? 'bg-pink-400 text-white border-pink-400 shadow-sm scale-105' 
                                : 'bg-white text-gray-500 border-gray-200 hover:border-pink-200'
                            }`}
                        >
                            {topic}
                        </button>
                    ))}
                    <button
                        onClick={() => setSelectedTopic(undefined)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                            selectedTopic === undefined
                            ? 'bg-pink-400 text-white border-pink-400 shadow-sm'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-pink-200'
                        }`}
                    >
                        Mix
                    </button>
                 </div>
            </div>

            <button
              onClick={handleStart}
              className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-indigo-500 rounded-full hover:bg-indigo-600 hover:shadow-lg hover:-translate-y-1 focus:outline-none ring-offset-2 focus:ring-2 ring-indigo-400 w-full"
            >
              <PlayCircle className="mr-2 group-hover:animate-pulse" />
              Start Class
            </button>
            
             {/* Progress List Mini */}
             {progress.completedTopics.length > 0 && (
                <div className="mt-6 border-t pt-4 border-gray-100">
                    <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">Things I know</p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {progress.completedTopics.slice(-5).map(topic => (
                            <span key={topic} className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-md border border-yellow-200">
                                {topic}
                            </span>
                        ))}
                    </div>
                </div>
             )}

          </div>
        )}

        {/* Loading State */}
        {connectionState === ConnectionState.CONNECTING && (
          <div className="flex flex-col items-center text-center">
            <Loader2 size={64} className="text-indigo-400 animate-spin mb-4" />
            <p className="text-xl text-indigo-800 font-medium">Waking up Mimi...</p>
          </div>
        )}

        {/* Active Session */}
        {connectionState === ConnectionState.CONNECTED && (
          <div className="flex flex-col items-center w-full h-full justify-center space-y-12">
            
            <div className="bg-white/40 p-10 sm:p-12 rounded-[3rem] backdrop-blur-md shadow-inner border border-white/50 relative">
                {/* Topic Bubble */}
                {selectedTopic && (
                    <div className="absolute -top-4 left-0 bg-pink-400 shadow-md rounded-full px-3 py-1 text-xs text-white font-bold border border-pink-200">
                         Topic: {selectedTopic}
                    </div>
                )}
                {/* Last Correct Topic */}
                {progress.completedTopics.length > 0 && (
                    <div className="absolute -top-4 right-0 bg-white shadow-md rounded-full px-3 py-1 text-xs text-indigo-500 font-bold border border-indigo-100 animate-bounce" style={{animationDuration: '3s'}}>
                         Last: {progress.completedTopics[progress.completedTopics.length - 1]}
                    </div>
                )}
                
                <Visualizer 
                    isActive={true} 
                    isSpeaking={isMimiSpeaking} 
                    volume={volume} 
                />
            </div>

            <div className="w-full max-w-xs text-center space-y-4">
                <div className="bg-indigo-100/50 px-4 py-2 rounded-full inline-block">
                     <p className="text-indigo-900/80 text-xs font-bold tracking-wide uppercase">Level: {progress.difficulty}</p>
                </div>
                <p className="text-indigo-900/60 text-sm font-medium">
                    {isMimiSpeaking ? "Listen carefully..." : "Your turn to speak!"}
                </p>

                <button
                onClick={handleStop}
                className="inline-flex items-center px-6 py-3 bg-red-100 text-red-600 rounded-full font-bold hover:bg-red-200 transition-colors shadow-sm"
                >
                <Power size={20} className="mr-2" />
                Stop Class
                </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {connectionState === ConnectionState.ERROR && (
             <div className="bg-red-50 p-6 rounded-2xl text-center max-w-xs border border-red-100">
             <h3 className="text-red-800 font-bold text-lg mb-2">Oh no!</h3>
             <p className="text-red-600 mb-4">Mimi couldn't connect. Maybe check your internet?</p>
             <button
               onClick={() => {
                   disconnect(); // Reset state
                   handleStart(); // Try again
               }}
               className="bg-red-200 text-red-800 px-4 py-2 rounded-lg font-bold hover:bg-red-300"
             >
               Try Again
             </button>
           </div>
        )}

      </main>

      <footer className="w-full text-center py-4 text-indigo-200 text-xs">
         <p>Safe & Friendly AI Learning</p>
      </footer>
    </div>
  );
};

export default App;