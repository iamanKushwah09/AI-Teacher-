import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { ConnectionState } from '../types';
import { createBlob, decode, decodeAudioData } from '../utils/audio';
import { playFeedbackSound } from '../utils/soundEffects';

// Tool definition for reporting correctness
const evaluationTool: FunctionDeclaration = {
  name: 'reportEvaluation',
  description: 'Call this function to report if the child answered correctly or incorrectly, before speaking the response.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      isCorrect: {
        type: Type.BOOLEAN,
        description: 'True if the child answered correctly, False otherwise.',
      },
      topic: {
        type: Type.STRING,
        description: 'The specific topic (1-2 words) of the question just answered (e.g., "Colors", "Math", "Animals").',
      },
    },
    required: ['isCorrect'],
  },
};

// Dynamic System Instructions based on difficulty and optional focus topic
const GET_SYSTEM_INSTRUCTION = (difficulty: string, focusTopic?: string) => `
You are "Mimi", a friendly, caring AI teacher designed specially for small children.
Your current difficulty setting is: ${difficulty.toUpperCase()}.
${focusTopic ? `CURRENT LESSON TOPIC: "${focusTopic}".` : ''}

CORE RULES (ALL LEVELS):
1. Speak softly, kindly, and encouragingly.
2. Never mention that you are an AI.
3. Always praise the child gently, even if the answer is wrong.
4. IMPORTANT: When the child answers a question, you MUST FIRST call the tool "reportEvaluation".
   - Set "isCorrect" to true or false.
   - Set "topic" to ${focusTopic ? `"${focusTopic}"` : 'the subject of the question (e.g., "Colors", "Counting")'}.
   - Call the tool IMMEDIATELY after understanding the child's answer.
   - AFTER calling the tool, speak your verbal response (praise/hint + next question).
5. Always ask the next simple question after answering the child.
6. NO text formatting, no emojis, no long explanations.
7. YOUR OUTPUT MUST BE SPOKEN AUDIO ONLY.
${focusTopic ? `8. RESTRICTION: You must ONLY ask questions related to "${focusTopic}". Do not change the subject.` : ''}

LEVEL SPECIFIC GUIDELINES:

${difficulty === 'Easy' ? `
TARGET: Ages 4-5
TOPICS: Basic Colors, Animal Sounds, Counting (1-5), Simple Fruits/Foods.
STYLE: Ultra-short sentences (5-8 words). Very simple vocabulary.
HINTS: Give the answer directly or the first sound (e.g., "It starts with B...").
` : difficulty === 'Medium' ? `
TARGET: Ages 6-7
TOPICS: Shapes, Simple Addition (1+1, 2+2), Days of the Week, Weather, Opposites (Hot/Cold).
STYLE: Short sentences (8-12 words). Conversational but simple.
HINTS: Describe the object simply (e.g., "It is yellow and comes from a chicken").
` : `
TARGET: Ages 8-10
TOPICS: Subtraction, Basic Science (Plants, Rain), Geography (Continents/Oceans), Telling Time.
STYLE: Natural sentences (10-15 words).
HINTS: Ask a guiding question to help them figure it out (e.g., "What do plants drink when they are thirsty?").
`}

EXAMPLE FLOW:
Teacher: "Hi sweetie, ready? Here is your first question. What color is a banana?"
Child answers.
[Tool Call: reportEvaluation(isCorrect: true, topic: "${focusTopic || 'Colors'}")]
Teacher: "Great job! A banana is yellow. Now, can you tell me what a cat says?"

GOAL: Make the child feel safe, happy, and confident.
`;

interface UseGeminiLiveProps {
    onEvaluation?: (isCorrect: boolean, topic?: string) => void;
}

export const useGeminiLive = ({ onEvaluation }: UseGeminiLiveProps = {}) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [isMimiSpeaking, setIsMimiSpeaking] = useState(false);
  const [volume, setVolume] = useState(0); // For visualizer

  // Refs for Audio Contexts and Processor
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  
  // Refs for Playback timing
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Ref for the session promise to avoid stale closures
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  // Ref for callback to avoid dependency issues in connect
  const onEvaluationRef = useRef(onEvaluation);
  
  // Update ref when prop changes
  useEffect(() => {
    onEvaluationRef.current = onEvaluation;
  }, [onEvaluation]);

  const disconnect = useCallback(() => {
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => {
            try {
                session.close();
            } catch (e) {
                console.warn("Error closing session", e);
            }
        });
        sessionPromiseRef.current = null;
    }

    // Stop Microphone Stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Disconnect Input Audio Nodes
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }

    // Stop Output Audio
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    setConnectionState(ConnectionState.DISCONNECTED);
    setIsMimiSpeaking(false);
    setVolume(0);
  }, []);

  const connect = useCallback(async (difficulty: string, focusTopic?: string) => {
    try {
      setConnectionState(ConnectionState.CONNECTING);

      // Initialize GenAI
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Setup Audio Contexts
      // Input: 16kHz for Gemini
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputAudioContextRef.current = inputCtx;

      // Output: 24kHz for Gemini response
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      outputAudioContextRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      // Get Microphone Access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Start Session
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }, // Kore is usually soft/friendly
          },
          systemInstruction: GET_SYSTEM_INSTRUCTION(difficulty, focusTopic),
          tools: [{ functionDeclarations: [evaluationTool] }],
        },
        callbacks: {
          onopen: () => {
            console.log('Session opened');
            setConnectionState(ConnectionState.CONNECTED);

            // Setup Input Processing Pipeline
            const source = inputCtx.createMediaStreamSource(stream);
            inputSourceRef.current = source;

            // ScriptProcessor: BufferSize 4096, 1 input channel, 1 output channel
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Calculate volume for visualizer (RMS)
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sum / inputData.length);
              setVolume(Math.min(rms * 5, 1)); // Amplify slightly for visual

              // Create Blob and Send
              const pcmBlob = createBlob(inputData);
              
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then((session) => {
                   session.sendRealtimeInput({ media: pcmBlob });
                });
              }
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle Tool Calls (Sound Feedback & Progress)
             if (message.toolCall) {
                for (const fc of message.toolCall.functionCalls) {
                    if (fc.name === 'reportEvaluation') {
                        const isCorrect = fc.args['isCorrect'] as boolean;
                        // Use the provided topic if available, otherwise fall back to reported topic
                        let topic = fc.args['topic'] as string | undefined;
                        
                        playFeedbackSound(isCorrect);
                        
                        // Notify parent component via callback
                        if (onEvaluationRef.current) {
                            onEvaluationRef.current(isCorrect, topic);
                        }

                        // Respond to the tool to let the model continue
                        if (sessionPromiseRef.current) {
                            sessionPromiseRef.current.then(session => {
                                session.sendToolResponse({
                                    functionResponses: {
                                        id: fc.id,
                                        name: fc.name,
                                        response: { result: "ok" }
                                    }
                                });
                            });
                        }
                    }
                }
             }

             // Handle Audio Output
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             
             if (base64Audio) {
               if (!outputCtx) return;

               // Update state to show Mimi is talking
               setIsMimiSpeaking(true);

               // Ensure playback timing is continuous
               nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);

               const audioBytes = decode(base64Audio);
               const audioBuffer = await decodeAudioData(audioBytes, outputCtx, 24000, 1);
               
               const source = outputCtx.createBufferSource();
               source.buffer = audioBuffer;
               source.connect(outputCtx.destination);
               
               source.addEventListener('ended', () => {
                 sourcesRef.current.delete(source);
                 // If no more sources are playing, Mimi stopped talking
                 if (sourcesRef.current.size === 0) {
                     setIsMimiSpeaking(false);
                 }
               });

               source.start(nextStartTimeRef.current);
               nextStartTimeRef.current += audioBuffer.duration;
               sourcesRef.current.add(source);
             }

             // Handle interruptions
             if (message.serverContent?.interrupted) {
                 console.log("Interrupted");
                 sourcesRef.current.forEach(src => src.stop());
                 sourcesRef.current.clear();
                 nextStartTimeRef.current = outputCtx.currentTime;
                 setIsMimiSpeaking(false);
             }
          },
          onclose: () => {
            console.log('Session closed');
            disconnect();
          },
          onerror: (err) => {
            console.error('Session error', err);
            disconnect();
            setConnectionState(ConnectionState.ERROR);
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (error) {
      console.error("Failed to connect", error);
      setConnectionState(ConnectionState.ERROR);
      disconnect();
    }
  }, [disconnect]);

  // Clean up on unmount
  useEffect(() => {
      return () => {
          disconnect();
      }
  }, [disconnect]);

  return {
    connectionState,
    connect,
    disconnect,
    isMimiSpeaking,
    volume // Microphone input volume
  };
};