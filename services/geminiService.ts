
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

// Standard Base64 Decoding
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// PCM Decoder - Strict adherence to instructions
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  // Ensure the byte length is even for Int16Array
  const alignedLength = Math.floor(data.byteLength / 2) * 2;
  const dataInt16 = new Int16Array(data.buffer.slice(0, alignedLength));
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
