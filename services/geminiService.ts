
import { GoogleGenAI, Type, Modality } from "@google/genai";

const API_KEY = process.env.API_KEY || "";
const ai = new GoogleGenAI({ apiKey: API_KEY });

export const getWordDefinition = async (word: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Act as a dictionary. Provide a JSON definition for the word "${word}" in Chinese. Include phonetic, Chinese translation, and one example sentence.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          phonetic: { type: Type.STRING },
          translation: { type: Type.STRING },
          example: { type: Type.STRING }
        },
        required: ["word", "phonetic", "translation", "example"]
      }
    }
  });
  return JSON.parse(response.text);
};

export const verifyTranslation = async (english: string, targetChinese: string, userChinese: string) => {
  const prompt = `
    English Sentence: "${english}"
    Official Translation: "${targetChinese}"
    User's Interpretation: "${userChinese}"
    
    Is the user's interpretation semantically similar to the official translation? 
    Consider synonyms and context.
    Return JSON: { "isMatch": boolean, "feedback": string }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isMatch: { type: Type.BOOLEAN },
          feedback: { type: Type.STRING }
        },
        required: ["isMatch", "feedback"]
      }
    }
  });
  return JSON.parse(response.text);
};

export const generateAudio = async (text: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Audio generation failed");
  
  return `data:audio/pcm;base64,${base64Audio}`;
};

export const analyzePronunciation = async (audioBase64: string, mimeType: string, expectedText: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-native-audio-preview-09-2025",
    contents: {
      parts: [
        {
          inlineData: {
            data: audioBase64,
            mimeType: mimeType,
          },
        },
        {
          text: `You are an expert English pronunciation coach. Evaluate this audio where the user is shadowing the sentence: "${expectedText}". Provide a detailed evaluation in JSON format including a score (0-100) and specific feedback on pronunciation, speed, and intonation in Chinese.`,
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          pronunciation: { type: Type.STRING },
          speed: { type: Type.STRING },
          intonation: { type: Type.STRING },
          overallFeedback: { type: Type.STRING }
        },
        required: ["score", "pronunciation", "speed", "intonation", "overallFeedback"]
      }
    }
  });
  return JSON.parse(response.text);
};

// PCM Decoder Helper
export const decodePCM = async (base64: string, ctx: AudioContext) => {
  const binary = atob(base64.split(',')[1]);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const dataInt16 = new Int16Array(bytes.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
};
