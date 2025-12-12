import React from 'react';
import { useGeminiLive } from './hooks/useGeminiLive';
import { ConnectionState } from './types';
import Visualizer from './components/Visualizer';
import { Mic, Power, GraduationCap, PlayCircle, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const { connectionState, connect, disconnect, isMimiSpeaking, volume } = useGeminiLive();

  const handleStart = () => {
    connect();
  };

  const handleStop = () => {
    disconnect();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-indigo-50 flex flex-col items-center p-4 overflow-hidden relative">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-10 left-10 w-20 h-20 bg-yellow-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div className="absolute top-10 right-10 w-20 h-20 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-32 h-32 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>

      {/* Header */}
      <header className="w-full max-w-md flex items-center justify-between z-10 mb-8 mt-4">
        <div className="flex items-center space-x-2">
            <div className="bg-indigo-500 p-2 rounded-lg text-white">
                <GraduationCap size={28} />
            </div>
            <h1 className="text-3xl font-bold text-indigo-900 tracking-tight">Mimi</h1>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold ${connectionState === ConnectionState.CONNECTED ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
          {connectionState === ConnectionState.CONNECTED ? 'ONLINE' : 'OFFLINE'}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-md flex flex-col items-center justify-center relative z-10">
        
        {/* Intro Card (Only when disconnected) */}
        {connectionState === ConnectionState.DISCONNECTED && (
          <div className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl text-center border-2 border-white">
            <div className="mb-6 flex justify-center">
                <div className="w-32 h-32 bg-sky-100 rounded-full flex items-center justify-center">
                   <img 
                    src="https://picsum.photos/200/200?random=1" 
                    alt="Mimi Placeholder" 
                    className="w-28 h-28 rounded-full object-cover border-4 border-white"
                   />
                </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Hi! I'm Mimi.</h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              I'm your new teacher friend! We can talk about colors, numbers, and animals. 
              <br/><br/>
              <span className="text-indigo-500 font-bold">Are you ready to play?</span>
            </p>
            <button
              onClick={handleStart}
              className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-indigo-500 rounded-full hover:bg-indigo-600 hover:shadow-lg hover:-translate-y-1 focus:outline-none ring-offset-2 focus:ring-2 ring-indigo-400 w-full"
            >
              <PlayCircle className="mr-2 group-hover:animate-pulse" />
              Start Class
            </button>
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
            
            <div className="bg-white/40 p-12 rounded-[3rem] backdrop-blur-md shadow-inner border border-white/50">
                <Visualizer 
                    isActive={true} 
                    isSpeaking={isMimiSpeaking} 
                    volume={volume} 
                />
            </div>

            <div className="w-full max-w-xs text-center space-y-4">
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