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

  // Parse Thai number words into a numeric value (supports 1-99)
  const parseThaiNumber = useCallback((word: string): number | null => {
    const units: Record<string, number> = {
      'หนึ่ง': 1, 'เอ็ด': 1, 'สอง': 2, 'สาม': 3, 'สี่': 4, 'ห้า': 5,
      'หก': 6, 'เจ็ด': 7, 'แปด': 8, 'เก้า': 9,
    };
    const tens: Record<string, number> = {
      'สิบ': 10, 'ยี่สิบ': 20, 'สามสิบ': 30, 'สี่สิบ': 40, 'ห้าสิบ': 50,
      'หกสิบ': 60, 'เจ็ดสิบ': 70, 'แปดสิบ': 80, 'เก้าสิบ': 90,
    };

    const w = word.trim();

    // Direct unit match (1-9)
    if (units[w] !== undefined) return units[w];

    // Direct tens match (10, 20, 30...)
    if (tens[w] !== undefined) return tens[w];

    // Compound: tens + unit (e.g. "ยี่สิบเอ็ด" = 21, "สามสิบห้า" = 35)
    // Sort tens by length descending to match longer prefixes first
    const sortedTens = Object.entries(tens).sort((a, b) => b[0].length - a[0].length);
    for (const [tenWord, tenVal] of sortedTens) {
      if (w.startsWith(tenWord)) {
        const remainder = w.slice(tenWord.length);
        if (!remainder) return tenVal;
        if (units[remainder] !== undefined) return tenVal + units[remainder];
      }
    }

    return null;
  }, []);

  // Extract Thai number words from text, returning array of {value, startIndex, endIndex}
  const extractThaiNumbers = useCallback((text: string): number[] => {
    const results: number[] = [];
    const tens = ['เก้าสิบ', 'แปดสิบ', 'เจ็ดสิบ', 'หกสิบ', 'ห้าสิบ', 'สี่สิบ', 'สามสิบ', 'ยี่สิบ', 'สิบ'];
    const units = ['เอ็ด', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    
    let remaining = text;
    
    while (remaining.length > 0) {
      let matched = false;
      
      // Try to match a compound number (tens + optional unit)
      for (const ten of tens) {
        if (remaining.includes(ten)) {
          const idx = remaining.indexOf(ten);
          const afterTen = remaining.slice(idx + ten.length);
          let unitVal = 0;
          let unitLen = 0;
          
          for (const unit of units) {
            if (afterTen.startsWith(unit)) {
              const uv = parseThaiNumber(unit);
              if (uv !== null) {
                unitVal = uv;
                unitLen = unit.length;
                break;
              }
            }
          }
          
          const tenVal = parseThaiNumber(ten);
          if (tenVal !== null) {
            const total = tenVal + unitVal;
            if (total >= 1 && total <= destinations.length) {
              results.push(total);
            }
            remaining = remaining.slice(0, idx) + remaining.slice(idx + ten.length + unitLen);
            matched = true;
            break;
          }
        }
      }
      
      if (matched) continue;
      
      // Try single units
      let unitMatched = false;
      for (const unit of units) {
        if (remaining.includes(unit)) {
          const idx = remaining.indexOf(unit);
          const uv = parseThaiNumber(unit);
          if (uv !== null && uv >= 1 && uv <= destinations.length) {
            results.push(uv);
          }
          remaining = remaining.slice(0, idx) + remaining.slice(idx + unit.length);
          unitMatched = true;
          break;
        }
      }
      
      if (!unitMatched) break;
    }
    
    return results;
  }, [parseThaiNumber, destinations.length]);

  // Parse swap commands like "สลับจุด 2 กับจุด 3", "swap 2 and 3", "สลับจุดยี่สิบเอ็ดกับจุดสามสิบห้า"
  const parseSwapCommand = useCallback((text: string): { fromIndex: number; toIndex: number } | null => {
    const normalized = text.toLowerCase().trim();
    
    const numbers: number[] = [];
    
    // Match digit numbers first
    const digitMatches = normalized.match(/\d+/g);
    if (digitMatches) {
      for (const m of digitMatches) {
        const n = parseInt(m, 10);
        if (n >= 1 && n <= destinations.length) {
          numbers.push(n);
        }
      }
    }

    // Match Thai number words if not enough digits found
    if (numbers.length < 2) {
      const thaiNums = extractThaiNumbers(normalized);
      for (const n of thaiNums) {
        if (!numbers.includes(n)) {
          numbers.push(n);
        }
        if (numbers.length >= 2) break;
      }
    }

    if (numbers.length >= 2) {
      return { fromIndex: numbers[0] - 1, toIndex: numbers[1] - 1 };
    }

    return null;
  }, [destinations.length, extractThaiNumbers]);

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
      if (event.error === 'aborted' || event.error === 'network') {
        // Silently ignore - aborted is normal when user stops, network is preview env issue
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
