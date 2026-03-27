import { useState, useCallback, useRef, useEffect } from 'react';

interface VoiceReorderResult {
  matchedDestination: { id: string; name: string; index: number } | null;
  transcript: string;
}

interface UseVoiceReorderOptions {
  destinations: { id: string; company_name?: string; location?: string }[];
  language?: string;
  onMatch?: (result: VoiceReorderResult) => void;
}

export function useVoiceReorder({ destinations, language = 'th', onMatch }: UseVoiceReorderOptions) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const onMatchRef = useRef(onMatch);
  onMatchRef.current = onMatch;

  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const findBestMatch = useCallback((text: string): VoiceReorderResult => {
    const normalized = text.toLowerCase().trim();
    let bestMatch: VoiceReorderResult['matchedDestination'] = null;
    let bestScore = 0;

    destinations.forEach((dest, index) => {
      const names = [dest.company_name, dest.location].filter(Boolean) as string[];
      
      for (const name of names) {
        const destNorm = name.toLowerCase().trim();
        
        // Exact match
        if (normalized.includes(destNorm) || destNorm.includes(normalized)) {
          const score = destNorm.length;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = { id: dest.id, name: dest.company_name || dest.location || '', index };
          }
          continue;
        }

        // Partial word match - check if any significant words match
        const spokenWords = normalized.split(/\s+/);
        const destWords = destNorm.split(/\s+/);
        let matchedChars = 0;
        for (const sw of spokenWords) {
          for (const dw of destWords) {
            if (dw.includes(sw) || sw.includes(dw)) {
              matchedChars += Math.min(sw.length, dw.length);
            }
          }
        }
        if (matchedChars >= 2 && matchedChars > bestScore) {
          bestScore = matchedChars;
          bestMatch = { id: dest.id, name: dest.company_name || dest.location || '', index };
        }
      }
    });

    return { matchedDestination: bestMatch, transcript: text };
  }, [destinations]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('เบราว์เซอร์ไม่รองรับการสั่งงานด้วยเสียง');
      return;
    }

    setError(null);
    setTranscript('');

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : language === 'ko' ? 'ko-KR' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t;
        } else {
          interimTranscript += t;
        }
      }

      const displayText = finalTranscript || interimTranscript;
      setTranscript(displayText);

      if (finalTranscript) {
        const result = findBestMatch(finalTranscript);
        onMatchRef.current?.(result);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('[VoiceReorder] error:', event.error);
      if (event.error === 'no-speech') {
        setError('ไม่ได้ยินเสียง ลองพูดอีกครั้ง');
      } else if (event.error === 'not-allowed') {
        setError('ไม่ได้รับอนุญาตใช้ไมโครโฟน');
      } else {
        setError(`เกิดข้อผิดพลาด: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, language, findBestMatch]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return {
    isListening,
    transcript,
    error,
    isSupported,
    startListening,
    stopListening,
  };
}
