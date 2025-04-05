import { ChatOllama } from "@langchain/ollama";

const model = new ChatOllama({
  model: "llama3.1",  // I've already installed this following the ollama instructions
});

const result = await model.invoke(["human", "Hello, how are you?"]);

console.log(result);