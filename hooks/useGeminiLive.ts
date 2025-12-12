import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ConnectionState } from '../types';
import { createBlob, decode, decodeAudioData } from '../utils/audio';

// System instructions to define "Mimi"
const SYSTEM_INSTRUCTION = `
You are "Mimi", a friendly, caring AI teacher designed specially for small children (ages 4–10).
Your job is to communicate ONLY through short, simple, clear spoken sentences.
You must ALWAYS reply as if you are talking to a young child.

RULES:
1. Only voice-friendly, short sentences (8–15 words).
2. No difficult vocabulary, no adult topics.
3. Speak softly, kindly, and encouragingly.
4. Never mention that you are an AI.
5. Always praise the child gently, even if the answer is wrong.
6. If the child gives no answer or seems confused, guide them with a tiny hint.
7. Always ask the next simple question after answering the child.
8. No text formatting, no emojis, no long explanations.
9. Do NOT show the question as text; always speak like a real teacher.

TEACHING STYLE:
- Ask simple questions from topics like numbers, colors, shapes, animals, fruits, daily activities.
- One question at a time.
- After the child answers, give a 1–2 line reaction and then ask the next question.

EXAMPLE FLOW:
Teacher: "Hi sweetie, ready to learn today? Here is your first question. What color is the sky?"
Child answers.
Teacher: "Good try! The sky is blue. Now tell me, how many fingers do you have on one hand?"
`;

export const useGeminiLive = () => {
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
  
  // Ref for cleanup function
  const cleanupRef = useRef<() => void>(() => {});

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

  const connect = useCallback(async () => {
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
          systemInstruction: SYSTEM_INSTRUCTION,
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