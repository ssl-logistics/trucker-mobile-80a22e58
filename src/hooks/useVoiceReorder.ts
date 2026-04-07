import { useState, useCallback, useRef, useEffect } from 'react';

interface VoiceReorderResult {
  matchedDestination: { id: string; name: string; index: number } | null;
  swapCommand?: { fromIndex: number; toIndex: number } | null;
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

  // Parse swap commands like "สลับจุด 2 กับจุด 3", "สลับจุดยี่สิบเอ็ดกับจุดสามสิบห้า"
  const parseSwapCommand = useCallback((text: string): { fromIndex: number; toIndex: number } | null => {
    const normalized = text.toLowerCase().trim();

    // --- Thai number helpers (plain functions, not hooks) ---
    const unitMap: Record<string, number> = {
      'หนึ่ง': 1, 'เอ็ด': 1, 'สอง': 2, 'สาม': 3, 'สี่': 4, 'ห้า': 5,
      'หก': 6, 'เจ็ด': 7, 'แปด': 8, 'เก้า': 9,
    };
    const tenMap: Record<string, number> = {
      'สิบ': 10, 'ยี่สิบ': 20, 'สามสิบ': 30, 'สี่สิบ': 40, 'ห้าสิบ': 50,
      'หกสิบ': 60, 'เจ็ดสิบ': 70, 'แปดสิบ': 80, 'เก้าสิบ': 90,
    };
    const sortedTens = Object.entries(tenMap).sort((a, b) => b[0].length - a[0].length);
    const unitWords = ['เอ็ด', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];

    const parseThaiNum = (w: string): number | null => {
      if (unitMap[w] !== undefined) return unitMap[w];
      if (tenMap[w] !== undefined) return tenMap[w];
      for (const [tenWord, tenVal] of sortedTens) {
        if (w.startsWith(tenWord)) {
          const rest = w.slice(tenWord.length);
          if (!rest) return tenVal;
          if (unitMap[rest] !== undefined) return tenVal + unitMap[rest];
        }
      }
      return null;
    };

    const extractThaiNums = (txt: string): number[] => {
      const results: number[] = [];
      let rem = txt;
      const maxLen = destinations.length;
      for (let safety = 0; safety < 20 && rem.length > 0; safety++) {
        let found = false;
        for (const [tenWord] of sortedTens) {
          const idx = rem.indexOf(tenWord);
          if (idx === -1) continue;
          const afterTen = rem.slice(idx + tenWord.length);
          let uVal = 0, uLen = 0;
          for (const uw of unitWords) {
            if (afterTen.startsWith(uw)) {
              const v = parseThaiNum(uw);
              if (v !== null) { uVal = v; uLen = uw.length; }
              break;
            }
          }
          const tVal = parseThaiNum(tenWord);
          if (tVal !== null) {
            const total = tVal + uVal;
            if (total >= 1 && total <= maxLen) results.push(total);
            rem = rem.slice(0, idx) + rem.slice(idx + tenWord.length + uLen);
            found = true;
            break;
          }
        }
        if (found) continue;
        let uFound = false;
        for (const uw of unitWords) {
          const idx = rem.indexOf(uw);
          if (idx === -1) continue;
          const v = parseThaiNum(uw);
          if (v !== null && v >= 1 && v <= maxLen) results.push(v);
          rem = rem.slice(0, idx) + rem.slice(idx + uw.length);
          uFound = true;
          break;
        }
        if (!uFound) break;
      }
      return results;
    };

    // --- Extract numbers ---
    const numbers: number[] = [];

    // Digit numbers first
    const digitMatches = normalized.match(/\d+/g);
    if (digitMatches) {
      for (const m of digitMatches) {
        const n = parseInt(m, 10);
        if (n >= 1 && n <= destinations.length) numbers.push(n);
      }
    }

    // Thai number words if not enough digits
    if (numbers.length < 2) {
      const thaiNums = extractThaiNums(normalized);
      for (const n of thaiNums) {
        if (!numbers.includes(n)) numbers.push(n);
        if (numbers.length >= 2) break;
      }
    }

    if (numbers.length >= 2) {
      return { fromIndex: numbers[0] - 1, toIndex: numbers[1] - 1 };
    }
    return null;
  }, [destinations.length]);

  const findBestMatch = useCallback((text: string): VoiceReorderResult => {
    // First, try to parse as a swap command with numbers
    const swapCmd = parseSwapCommand(text);
    if (swapCmd) {
      return { matchedDestination: null, swapCommand: swapCmd, transcript: text };
    }

    const normalized = text.toLowerCase().trim();
    let bestMatch: VoiceReorderResult['matchedDestination'] = null;
    let bestScore = 0;

    destinations.forEach((dest, index) => {
      const names = [dest.company_name, dest.location].filter(Boolean) as string[];
      
      for (const name of names) {
        const destNorm = name.toLowerCase().trim();
        
        if (normalized.includes(destNorm) || destNorm.includes(normalized)) {
          const score = destNorm.length;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = { id: dest.id, name: dest.company_name || dest.location || '', index };
          }
          continue;
        }

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

    return { matchedDestination: bestMatch, swapCommand: null, transcript: text };
  }, [destinations, parseSwapCommand]);

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
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    // Auto-stop after 8 seconds to save battery
    const autoStopTimer = setTimeout(() => {
      try { recognition.stop(); } catch {}
    }, 8000);

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let fullTranscript = '';
      let hasFinal = false;

      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
        if (event.results[i].isFinal) hasFinal = true;
      }

      setTranscript(fullTranscript);

      if (hasFinal) {
        const result = findBestMatch(fullTranscript);
        if (result.swapCommand || result.matchedDestination) {
          // Found a match - stop listening and fire callback
          clearTimeout(autoStopTimer);
          try { recognition.stop(); } catch {}
          onMatchRef.current?.(result);
        }
      }
    };

    recognition.onend = () => {
      clearTimeout(autoStopTimer);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('[VoiceReorder] error:', event.error);
      clearTimeout(autoStopTimer);
      if (event.error === 'aborted' || event.error === 'network') {
        setIsListening(false);
        return;
      }
      if (event.error === 'no-speech') {
        setError('ไม่ได้ยินเสียง ลองพูดอีกครั้ง');
      } else if (event.error === 'not-allowed') {
        setError('ไม่ได้รับอนุญาตใช้ไมโครโฟน');
      } else {
        setError(`เกิดข้อผิดพลาด: ${event.error}`);
      }
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
