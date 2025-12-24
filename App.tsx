
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Difficulty, Article, Step, WordDefinition, Sentence } from './types';
import { ARTICLES } from './constants';
import { 
  getWordDefinition, 
  verifyTranslation, 
  generateAudio, 
  decodeBase64, 
  decodeAudioData, 
  analyzePronunciation 
} from './services/geminiService';

// --- Shared Components ---

const ProgressBar: React.FC<{ current: number; total: number }> = ({ current, total }) => (
  <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
    <div 
      className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
      style={{ width: `${(current / total) * 100}%` }}
    ></div>
  </div>
);

// --- Global Audio Singleton ---
let globalAudioCtx: AudioContext | null = null;

const getAudioCtx = () => {
  if (!globalAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    globalAudioCtx = new AudioContextClass({ sampleRate: 24000 });
  }
  return globalAudioCtx;
};

// --- Audio Manager Hook ---
const useAudio = () => {
  const initContext = useCallback(async () => {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    return ctx;
  }, []);

  const playBuffer = useCallback(async (base64: string) => {
    const ctx = getAudioCtx();
    // CRITICAL: We don't await resume here because it might lose the user gesture token
    // It should have been resumed in the top-level click handler
    const bytes = decodeBase64(base64);
    const buffer = await decodeAudioData(bytes, ctx, 24000, 1);
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    return source;
  }, []);

  return { initContext, playBuffer };
};

// --- Step Components ---

const Step0Selection: React.FC<{ onSelect: (article: Article) => void }> = ({ onSelect }) => {
  const [filter, setFilter] = useState<Difficulty>(Difficulty.Beginner);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">Select Your Challenge</h1>
      <div className="flex justify-center gap-4 mb-8">
        {Object.values(Difficulty).map(d => (
          <button
            key={d}
            onClick={() => setFilter(d)}
            className={`px-6 py-2 rounded-full font-medium transition-colors ${
              filter === d ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-600 border hover:bg-gray-50'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ARTICLES.filter(a => a.difficulty === filter).map(article => (
          <div 
            key={article.id}
            onClick={() => onSelect(article)}
            className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group"
          >
            <h3 className="text-xl font-semibold mb-2 group-hover:text-blue-600">{article.title}</h3>
            <p className="text-gray-500 text-sm mb-4">{article.description}</p>
            <div className="flex items-center text-blue-500 font-medium">
              Start Learning <span className="ml-2">→</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Step1BlindListening: React.FC<{ article: Article; onComplete: () => void }> = ({ article, onComplete }) => {
  const [repeats, setRepeats] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const { initContext, playBuffer } = useAudio();

  const handlePlay = async () => {
    if (loadingAudio || isPlaying) return;
    
    // SYNC: Resume context immediately in click event
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    setLoadingAudio(true);
    try {
      const fullText = article.content.map(s => s.english).join(' ');
      const base64Audio = await generateAudio(fullText);
      const source = await playBuffer(base64Audio);
      
      source.onended = () => {
        setRepeats(prev => prev + 1);
        setIsPlaying(false);
      };
      setIsPlaying(true);
      source.start(0);
    } catch (err) {
      console.error("Audio playback error:", err);
      setIsPlaying(false);
    } finally {
      setLoadingAudio(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-12 glass rounded-3xl text-center shadow-xl">
      <div className="mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 text-blue-600 rounded-full mb-4">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">Step 1: Blind Listening</h2>
        <p className="text-gray-500">Listen to the full article 3 times without subtitles.</p>
      </div>

      <div className="text-6xl font-black text-blue-600 mb-8">{repeats}/3</div>

      <button
        onClick={handlePlay}
        disabled={isPlaying || loadingAudio}
        className={`px-10 py-4 rounded-full font-bold text-lg shadow-lg transition-all ${
          isPlaying || loadingAudio ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {loadingAudio ? 'Generating Audio...' : isPlaying ? 'Listening...' : 'Play Audio'}
      </button>

      {repeats >= 3 && (
        <button
          onClick={onComplete}
          className="mt-8 block w-full py-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors"
        >
          Next Step: Dictation
        </button>
      )}
    </div>
  );
};

const Step2Dictation: React.FC<{ article: Article; onComplete: () => void }> = ({ article, onComplete }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [loadingAudio, setLoadingAudio] = useState(false);
  const { playBuffer } = useAudio();

  const handlePlaySentence = async () => {
    // SYNC: Resume context
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    setLoadingAudio(true);
    try {
      const base64Audio = await generateAudio(article.content[currentIdx].english);
      const source = await playBuffer(base64Audio);
      source.start(0);
    } catch (err) {
      console.error("Sentence playback error:", err);
    } finally {
      setLoadingAudio(false);
    }
  };

  const handleNext = () => {
    if (currentIdx < article.content.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setUserInput("");
    } else {
      onComplete();
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8 glass rounded-3xl shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Step 2: Dictation</h2>
        <span className="text-sm font-medium text-gray-400">Sentence {currentIdx + 1} of {article.content.length}</span>
      </div>
      <ProgressBar current={currentIdx + 1} total={article.content.length} />

      <div className="bg-blue-50 p-12 rounded-2xl mb-6 text-center">
        <button
          onClick={handlePlaySentence}
          disabled={loadingAudio}
          className="w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform mx-auto mb-4"
        >
          {loadingAudio ? (
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
          ) : (
            <svg className="w-10 h-10 ml-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
          )}
        </button>
        <p className="text-blue-600 font-medium">Click to hear the sentence</p>
      </div>

      <textarea
        value={userInput}
        onChange={(e) => setUserInput(e.target.value)}
        placeholder="Type what you hear..."
        className="w-full h-40 p-6 border-2 border-gray-100 rounded-2xl focus:border-blue-500 focus:outline-none transition-colors text-lg"
      />

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleNext}
          className="px-10 py-4 bg-blue-600 text-white rounded-full font-bold shadow-lg hover:bg-blue-700 transition-all"
        >
          {currentIdx === article.content.length - 1 ? 'Finish Dictation' : 'Next Sentence'}
        </button>
      </div>
    </div>
  );
};

const Step3Comprehension: React.FC<{ article: Article; onComplete: () => void }> = ({ article, onComplete }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [userTranslation, setUserTranslation] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [feedback, setFeedback] = useState<{isMatch: boolean, feedback: string} | null>(null);
  const [selectedWord, setSelectedWord] = useState<WordDefinition | null>(null);
  const [isDictionaryLoading, setIsDictionaryLoading] = useState(false);
  const [hasPaid, setHasPaid] = useState(false);

  const handleWordClick = async (word: string) => {
    setIsDictionaryLoading(true);
    try {
      const cleaned = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
      const def = await getWordDefinition(cleaned);
      setSelectedWord(def);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDictionaryLoading(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const sentence = article.content[currentIdx];
      const result = await verifyTranslation(sentence.english, sentence.chinese, userTranslation);
      setFeedback(result);
      if (result.isMatch) setShowResult(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  const nextSentence = () => {
    if (currentIdx < article.content.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setShowResult(false);
      setUserTranslation("");
      setFeedback(null);
    } else {
      onComplete();
    }
  };

  if (!hasPaid) {
    return (
      <div className="max-w-md mx-auto p-12 glass rounded-3xl shadow-2xl text-center">
        <h2 className="text-3xl font-black mb-4">Level Up!</h2>
        <p className="text-gray-500 mb-8">You've completed the listening and dictation phases. To unlock the AI Comprehension & Verification engine, please support us.</p>
        <div className="bg-blue-50 p-6 rounded-2xl mb-8">
          <div className="text-sm text-blue-600 font-bold uppercase tracking-wider mb-2">Lifetime Access</div>
          <div className="text-5xl font-black text-blue-600">$9.99</div>
        </div>
        <button
          onClick={() => setHasPaid(true)}
          className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xl shadow-xl hover:bg-blue-700 active:scale-95 transition-all"
        >
          Unlock Full Content
        </button>
      </div>
    );
  }

  const currentSentence = article.content[currentIdx];

  return (
    <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-8">
      <div className="flex-1 glass p-8 rounded-3xl shadow-xl relative">
        <h2 className="text-2xl font-bold mb-6">Step 3: Comprehension Check</h2>
        <ProgressBar current={currentIdx + 1} total={article.content.length} />

        <div className="mb-8 p-6 bg-gray-50 rounded-2xl">
          <div className="text-2xl font-medium leading-relaxed">
            {currentSentence.english.split(' ').map((word, i) => (
              <span 
                key={i} 
                onClick={() => handleWordClick(word)}
                className="cursor-pointer hover:text-blue-600 hover:underline mr-1"
              >
                {word}
              </span>
            ))}
          </div>
        </div>

        {!showResult ? (
          <div className="space-y-4">
            <p className="font-semibold text-gray-600">Translate this sentence to Chinese:</p>
            <textarea
              value={userTranslation}
              onChange={(e) => setUserTranslation(e.target.value)}
              className="w-full h-32 p-4 border rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Enter your translation..."
            />
            <button
              onClick={handleVerify}
              disabled={isVerifying || !userTranslation}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50"
            >
              {isVerifying ? 'AI Checking...' : 'Verify Meaning'}
            </button>
            {feedback && !feedback.isMatch && (
              <p className="text-red-500 mt-2 text-sm">💡 {feedback.feedback}</p>
            )}
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="p-6 bg-green-50 border border-green-200 rounded-2xl">
              <h4 className="font-bold text-green-800 mb-2">Official Meaning</h4>
              <p className="text-xl">{currentSentence.chinese}</p>
            </div>
            <button
              onClick={nextSentence}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg"
            >
              {currentIdx === article.content.length - 1 ? 'Finish Phase' : 'Next Sentence'}
            </button>
          </div>
        )}
      </div>

      <div className="w-full md:w-80 space-y-6">
        <div className="glass p-6 rounded-3xl shadow-lg h-full">
          <h3 className="font-bold text-gray-700 border-b pb-4 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            AI Dictionary
          </h3>
          {isDictionaryLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : selectedWord ? (
            <div className="animate-in slide-in-from-right-4 duration-300">
              <div className="text-3xl font-black text-blue-600 mb-1">{selectedWord.word}</div>
              <div className="text-gray-400 font-mono mb-4">{selectedWord.phonetic}</div>
              <div className="text-lg font-bold text-gray-800 mb-2">释义:</div>
              <div className="text-gray-600 mb-4">{selectedWord.translation}</div>
              <div className="text-lg font-bold text-gray-800 mb-2">例句:</div>
              <div className="text-gray-600 text-sm italic">"{selectedWord.example}"</div>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-12 italic">Click a word to see its definition instantly.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const Step4Shadowing: React.FC<{ article: Article; onComplete: () => void }> = ({ article, onComplete }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingModel, setIsPlayingModel] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<any>(null);
  
  const { playBuffer } = useAudio();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handlePlaySentence = async () => {
    // SYNC: Resume context
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    setIsPlayingModel(true);
    try {
      const base64Audio = await generateAudio(article.content[currentIdx].english);
      const source = await playBuffer(base64Audio);
      source.onended = () => setIsPlayingModel(false);
      source.start(0);
    } catch (err) {
      console.error("Shadowing playback error:", err);
      setIsPlayingModel(false);
    }
  };

  const startRecording = async () => {
    try {
      if (!window.isSecureContext) {
        alert("Audio recording requires a secure context (HTTPS or localhost).");
        return;
      }
      
      // SYNC: Resume context before stream
      const ctx = getAudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleAudioAnalysis(audioBlob);
      };

      recorder.start();
      setIsRecording(true);
      setAiFeedback(null);
    } catch (err) {
      console.error("Recording failed", err);
      alert("Could not start recording. Please check microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleAudioAnalysis = async (blob: Blob) => {
    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        const feedback = await analyzePronunciation(
          base64data, 
          'audio/webm', 
          article.content[currentIdx].english
        );
        setAiFeedback(feedback);
      };
    } catch (err) {
      console.error("Analysis failed", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNext = () => {
    if (currentIdx < article.content.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setAiFeedback(null);
    } else {
      onComplete();
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8 glass rounded-3xl shadow-xl">
      <h2 className="text-2xl font-bold mb-6 text-center">Step 4: AI Shadowing Coach</h2>
      <ProgressBar current={currentIdx + 1} total={article.content.length} />

      <div className="mb-10 text-center">
        <div className="p-8 bg-white border border-gray-100 rounded-2xl mb-4 shadow-inner">
          <p className="text-3xl font-medium leading-relaxed text-gray-800 mb-2">
            {article.content[currentIdx].english}
          </p>
          <p className="text-gray-400">{article.content[currentIdx].chinese}</p>
        </div>
        <p className="text-sm text-gray-500">Goal: Match the native speaker's speed and intonation.</p>
      </div>

      <div className="flex justify-center items-center gap-12 mb-10">
        <button
          onClick={handlePlaySentence}
          disabled={isPlayingModel || isRecording || isAnalyzing}
          className="flex flex-col items-center group disabled:opacity-50"
        >
          <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-2 group-hover:bg-blue-600 group-hover:text-white transition-all">
            <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828a1 1 0 010-1.415z" clipRule="evenodd" /></svg>
          </div>
          <span className="font-bold">Listen Original</span>
        </button>

        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isPlayingModel || isAnalyzing}
          className="flex flex-col items-center group disabled:opacity-50"
        >
          <div className={`w-28 h-28 rounded-full flex items-center justify-center mb-2 shadow-xl transition-all ${
            isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>
          </div>
          <span className="font-bold">{isRecording ? 'Stop Recording' : 'Start Shadowing'}</span>
        </button>
      </div>

      {isAnalyzing && (
        <div className="p-8 text-center bg-gray-50 rounded-2xl mb-8 animate-pulse">
          <p className="text-blue-600 font-bold">AI is analyzing your pronunciation...</p>
        </div>
      )}

      {aiFeedback && (
        <div className="p-8 bg-white border border-blue-100 rounded-3xl mb-8 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-800">Feedback Report</h3>
            <div className={`text-4xl font-black ${aiFeedback.score >= 80 ? 'text-green-500' : aiFeedback.score >= 60 ? 'text-orange-500' : 'text-red-500'}`}>
              {aiFeedback.score}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Pronunciation</div>
              <p className="text-sm font-medium">{aiFeedback.pronunciation}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Speed</div>
              <p className="text-sm font-medium">{aiFeedback.speed}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Intonation</div>
              <p className="text-sm font-medium">{aiFeedback.intonation}</p>
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-xl">
            <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">AI Suggestion</div>
            <p className="text-sm text-blue-800">{aiFeedback.overallFeedback}</p>
          </div>
        </div>
      )}

      <button
        onClick={handleNext}
        className="w-full py-5 bg-green-600 text-white rounded-2xl font-black text-xl shadow-xl hover:bg-green-700 transition-all disabled:opacity-50"
      >
        {currentIdx === article.content.length - 1 ? 'Finish Lesson' : 'Next Sentence'}
      </button>
    </div>
  );
};

// --- Main App Controller ---

export default function App() {
  const [currentStep, setCurrentStep] = useState<Step>(Step.Selection);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const { initContext } = useAudio();

  const handleStartLesson = async (article: Article) => {
    // 关键点：在用户点击选择文章的瞬间，立即激活音频上下文
    try {
      await initContext();
    } catch (e) {
      console.warn("Failed to prime audio context", e);
    }
    setSelectedArticle(article);
    setCurrentStep(Step.BlindListening);
  };

  const handleStepComplete = () => {
    setCurrentStep(prev => prev + 1);
  };

  const reset = () => {
    setCurrentStep(Step.Selection);
    setSelectedArticle(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* HTTPS Check Warning */}
      {!window.isSecureContext && (
        <div className="bg-orange-500 text-white p-2 text-center text-xs font-bold">
          Warning: Secure context (HTTPS) required for microphone and audio features.
        </div>
      )}

      {/* Navbar */}
      <nav className="p-6 flex justify-between items-center border-b bg-white sticky top-0 z-50">
        <div 
          className="flex items-center gap-2 cursor-pointer group" 
          onClick={reset}
        >
          <div className="bg-blue-600 text-white p-2 rounded-lg group-hover:rotate-12 transition-transform">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          </div>
          <span className="text-xl font-black tracking-tight">FluentStep</span>
        </div>
        
        {selectedArticle && (
          <div className="hidden md:flex items-center gap-8">
            {Object.values(Step).filter(v => typeof v === 'number' && v > 0 && v < 5).map(s => (
              <div key={s} className={`flex flex-col items-center ${currentStep >= (s as number) ? 'text-blue-600' : 'text-gray-300'}`}>
                <div className={`w-2 h-2 rounded-full mb-1 ${currentStep >= (s as number) ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                <span className="text-[10px] uppercase font-bold tracking-widest">Step {s}</span>
              </div>
            ))}
          </div>
        )}

        <div>
          <button className="px-4 py-2 border rounded-full text-sm font-medium hover:bg-gray-50 transition-colors">Sign In</button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="container mx-auto mt-12 px-4">
        {currentStep === Step.Selection && <Step0Selection onSelect={handleStartLesson} />}
        
        {selectedArticle && currentStep === Step.BlindListening && (
          <Step1BlindListening article={selectedArticle} onComplete={handleStepComplete} />
        )}

        {selectedArticle && currentStep === Step.Dictation && (
          <Step2Dictation article={selectedArticle} onComplete={handleStepComplete} />
        )}

        {selectedArticle && currentStep === Step.Comprehension && (
          <Step3Comprehension article={selectedArticle} onComplete={handleStepComplete} />
        )}

        {selectedArticle && currentStep === Step.Shadowing && (
          <Step4Shadowing article={selectedArticle} onComplete={handleStepComplete} />
        )}

        {currentStep === Step.Completed && (
          <div className="max-w-2xl mx-auto p-12 glass rounded-3xl text-center shadow-2xl animate-in zoom-in duration-500">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 text-green-600 rounded-full mb-8">
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            </div>
            <h1 className="text-4xl font-black mb-4">Lesson Complete!</h1>
            <p className="text-xl text-gray-500 mb-10">You've mastered another session. Consistency is the key to fluency!</p>
            <div className="flex gap-4">
              <button onClick={reset} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all">Start New Lesson</button>
              <button className="flex-1 py-4 border-2 border-blue-600 text-blue-600 rounded-2xl font-bold hover:bg-blue-50 transition-all">View Statistics</button>
            </div>
          </div>
        )}
      </main>

      {/* Persistence Note: Mobile Bottom Bar */}
      {selectedArticle && currentStep !== Step.Selection && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t md:hidden flex justify-between items-center z-50">
          <span className="font-bold text-blue-600">{selectedArticle.title}</span>
          <button onClick={reset} className="text-gray-400 text-sm font-medium">Exit Lesson</button>
        </div>
      )}
    </div>
  );
}
