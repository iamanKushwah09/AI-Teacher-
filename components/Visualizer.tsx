import React from 'react';

interface VisualizerProps {
  isActive: boolean;
  isSpeaking: boolean; // Is Mimi speaking?
  volume: number; // User mic volume (0-1)
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, isSpeaking, volume }) => {
  // Determine the scale of the user's "listening" circle based on mic volume
  // Base scale is 1, max is 1.5
  const micScale = 1 + volume * 0.5;

  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      
      {/* Outer Ripple (Active) */}
      {isActive && (
        <div className={`absolute w-full h-full rounded-full bg-sky-200 opacity-50 ${isSpeaking ? 'animate-ping' : ''}`} style={{ animationDuration: '3s' }}></div>
      )}

      {/* Second Ripple */}
      {isActive && (
        <div className={`absolute w-48 h-48 rounded-full bg-sky-300 opacity-60 ${isSpeaking ? 'animate-pulse' : ''}`}></div>
      )}

      {/* Main Avatar Container */}
      <div 
        className="relative z-10 w-40 h-40 bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-sky-400 overflow-hidden transition-transform duration-100 ease-out"
        style={{ transform: !isSpeaking ? `scale(${micScale})` : 'scale(1)' }}
      >
        {/* Simple "Mimi" Face */}
        <div className="flex flex-col items-center justify-center space-y-2 animate-float">
            {/* Eyes */}
            <div className="flex space-x-4">
                <div className={`w-4 h-4 bg-gray-800 rounded-full transition-all duration-300 ${isSpeaking ? 'h-5' : 'h-4'}`}></div>
                <div className={`w-4 h-4 bg-gray-800 rounded-full transition-all duration-300 ${isSpeaking ? 'h-5' : 'h-4'}`}></div>
            </div>
            {/* Mouth */}
            <div className={`w-6 border-b-4 border-gray-800 rounded-full transition-all duration-200 ${isSpeaking ? 'h-3 w-8 border-4 border-transparent bg-gray-800' : 'h-2'}`}></div>
        </div>
      </div>

      {/* Status Badge */}
      <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
        {isActive ? (
           isSpeaking ? (
             <span className="bg-green-400 text-white px-4 py-1 rounded-full text-lg font-bold shadow-sm animate-bounce">
               Mimi is talking...
             </span>
           ) : (
             <span className="bg-orange-300 text-white px-4 py-1 rounded-full text-lg font-bold shadow-sm">
               Listening to you...
             </span>
           )
        ) : (
            <span className="bg-gray-300 text-gray-500 px-4 py-1 rounded-full text-sm font-bold">
               Sleeping
            </span>
        )}
      </div>

    </div>
  );
};

export default Visualizer;