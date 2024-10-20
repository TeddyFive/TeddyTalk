import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export async function analyzeImage(base64Image: string, useGemini: boolean = true): Promise<string> {
  const openaiApiKey = process.env.REACT_APP_OPENAI_API_KEY;
  const geminiApiKey = process.env.REACT_APP_GEMINI_API_KEY;

  if (useGemini && !geminiApiKey) {
    console.error("Gemini API key not found in environment variables");
    return "Failed to analyze the image due to missing Gemini API key.";
  }

  if (!useGemini && !openaiApiKey) {
    console.error("OpenAI API key not found in environment variables");
    return "Failed to analyze the image due to missing OpenAI API key.";
  }

  let model;
  
  if (useGemini) {
    model = new ChatGoogleGenerativeAI({ 
      modelName: "gemini-1.5-flash",
      apiKey: geminiApiKey,
    });
    console.log("modelName for image analysis is gemini-1.5-flash");
  } else {
    model = new ChatOpenAI({ 
      modelName: "gpt-4o",
      apiKey: openaiApiKey,
    });
    console.log("modelName for image analysis is gpt-4o");
  }

  try {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "Describe the image provided"],
      [
        "user",
        [{ type: "image_url", image_url: `data:image/jpeg;base64,${base64Image.split(',')[1]}` }],
      ],
    ]);

    const chain = prompt.pipe(model);
    const response = await chain.invoke({ base64: base64Image.split(',')[1] });
    return response.content as string;
  } catch (error) {
    console.error('Error analyzing image:', error);
    return "Failed to analyze the image.";
  }
}
