import { GoogleGenAI } from "@google/generative-ai";

// 从环境变量读取，如果读取不到则为空字符串
// 这样即便代码公开，别人也看不到你的 Key
const API_KEY = import.meta.env.VITE_GEMINI_KEY || ""; 

const genAI = new GoogleGenAI(API_KEY);

export const chatWithGemini = async (prompt: string) => {
  if (!API_KEY) {
    throw new Error("API Key 未配置，请检查环境变量");
  }
  
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);
  return result.response.text();
};
import { Difficulty, Article } from './types';

export const ARTICLES: Article[] = [
  // Beginner
  {
    id: 'b1',
    title: 'Daily Greetings and Self-Introduction',
    difficulty: Difficulty.Beginner,
    description: 'Learn how to introduce yourself and greet others in common social settings.',
    content: [
      { id: 1, english: "Hello, my name is Alex and I am glad to meet you.", chinese: "你好，我的名字是亚历克斯，很高兴见到你。" },
      { id: 2, english: "I come from a small town but I live in the city now.", chinese: "我来自一个小镇，但现在住在城市里。" },
      { id: 3, english: "What do you like to do in your free time?", chinese: "你空闲时间喜欢做什么？" }
    ]
  },
  {
    id: 'b2',
    title: 'Ordering Food at a Cafe',
    difficulty: Difficulty.Beginner,
    description: 'Practical phrases for ordering coffee and snacks.',
    content: [
      { id: 1, english: "Hi, I would like to order a large latte, please.", chinese: "你好，请给我来一杯大杯拿铁。" },
      { id: 2, english: "Would you like any sugar or milk with that?", chinese: "您需要加糖或牛奶吗？" },
      { id: 3, english: "No thanks, I prefer it black. How much is it?", chinese: "不用了，我喜欢原味的。多少钱？" }
    ]
  },
  // Intermediate
  {
    id: 'i1',
    title: 'Discussing Career Goals',
    difficulty: Difficulty.Intermediate,
    description: 'A conversation about professional aspirations and workplace skills.',
    content: [
      { id: 1, english: "I have been thinking about my career path lately.", chinese: "我最近一直在思考我的职业道路。" },
      { id: 2, english: "It is important to find a balance between passion and stability.", chinese: "在热情和稳定之间找到平衡是很重要的。" },
      { id: 3, english: "I want to improve my leadership skills to lead a bigger team.", chinese: "我想提高我的领导能力，以便带领更大的团队。" }
    ]
  },
  {
    id: 'i2',
    title: 'Travel Planning and Hidden Gems',
    difficulty: Difficulty.Intermediate,
    description: 'Tips for finding unique travel destinations and planning a trip.',
    content: [
      { id: 1, english: "Most tourists stick to the main attractions, which is a mistake.", chinese: "大多数游客只去主要景点，这是一个错误。" },
      { id: 2, english: "If you wander off the beaten path, you will find hidden gems.", chinese: "如果你走出常规路线，你会发现隐藏的瑰宝。" },
      { id: 3, english: "I recommend booking your flights at least three months in advance.", chinese: "我建议至少提前三个月预订机票。" }
    ]
  },
  // Advanced
  {
    id: 'a1',
    title: 'The Impact of AI on Society',
    difficulty: Difficulty.Advanced,
    description: 'A deep dive into how artificial intelligence is reshaping our daily lives.',
    content: [
      { id: 1, english: "The rapid evolution of generative AI has sparked intense global debate.", chinese: "生成式人工智能的快速演变引发了激烈的全球辩论。" },
      { id: 2, english: "Ethical considerations must be at the forefront of technological advancement.", chinese: "道德考量必须处于技术进步的前沿。" },
      { id: 3, english: "Automating routine tasks could lead to a significant shift in the labor market.", chinese: "自动化日常任务可能会导致劳动力市场的重大转变。" }
    ]
  }
];

// Fill up to 10 for each if needed, but for the demo we use these samples.
// In a real app, these would be fetched from a DB.
