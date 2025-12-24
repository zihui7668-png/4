
import { GoogleGenAI, Type, Modality } from "@google/genai";

const API_KEY = "AIzaSyBehYXQ09r1cjt6ABB0eOLyEWA14MF31J0";
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
  
  return base64Audio;
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

export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Optimized PCM Decoder - robust for all mobile browsers
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  // Use a temporary Buffer to ensure alignment
  const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const frameCount = Math.floor(arrayBuffer.byteLength / (2 * numChannels));
  const audioBuffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  
  const view = new DataView(arrayBuffer);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      const offset = (i * numChannels + channel) * 2;
      // Int16 signed PCM
      if (offset + 1 < arrayBuffer.byteLength) {
        const sample = view.getInt16(offset, true);
        channelData[i] = sample / 32768.0;
      }
    }
  }
  return audioBuffer;
}
