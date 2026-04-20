import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { Station, Connection, Metrics, GlobalSettings, AssemblyLine, SimulationResult } from "../types";

async function getChatCompletion(prompt: string, settings: GlobalSettings): Promise<string> {
  const provider = settings.aiProvider || 'gemini';
  const apiKey = settings.aiApiKey || (provider === 'gemini' ? process.env.GEMINI_API_KEY : '');
  
  if (!apiKey && provider !== 'custom') {
    throw new Error(`API Key for ${provider} is missing. Please provide it in settings.`);
  }

  const systemContext = settings.aiCustomPrompt 
    ? `\n\nUSER-PROVIDED CONTEXT / PERSONA:\n${settings.aiCustomPrompt}\n\n` 
    : '';
  
  const fullPrompt = `${prompt}${systemContext}`;

  try {
    if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: settings.aiModel || "gemini-1.5-flash",
        contents: fullPrompt,
      });
      return response.text || "No response from AI.";
    } else {
      // OpenAI or Custom
      const client = new OpenAI({
        apiKey,
        baseURL: provider === 'custom' ? settings.aiEndpoint : undefined,
        dangerouslyAllowBrowser: true // Use with caution in production
      });

      const response = await client.chat.completions.create({
        model: settings.aiModel || (provider === 'openai' ? 'gpt-4o' : 'custom-model'),
        messages: [{ role: 'user', content: fullPrompt }],
      });

      return response.choices[0]?.message?.content || "No response from AI.";
    }
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    if (errorMsg.includes('API key expired') || errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('invalid_api_key')) {
      throw new Error(`The ${provider.toUpperCase()} API key is expired or invalid. Please check your settings or environment variables and update the key.`);
    }
    throw error;
  }
}

export async function getSimulationInsights(
  stations: Station[],
  connections: Connection[],
  metrics: Metrics,
  settings: GlobalSettings
): Promise<string> {
  const prompt = `
    As an industrial engineering expert, analyze the following manufacturing line configuration and provide actionable insights.
    
    Static Analysis Data:
    - Total Stations: ${stations.length}
    - Total Connections: ${connections.length}
    - Demand: ${settings.demand} units
    - Available Time: ${settings.availableHours} hours
    - Takt Time: ${metrics.taktTime.toFixed(2)} min/unit
    - System Takt (Actual): ${metrics.systemTakt.toFixed(2)} min/unit
    - Line Output: ${metrics.lineOutput} units
    - Lead Time: ${metrics.leadTime.toFixed(2)} min
    - Line Efficiency: ${metrics.lineEfficiency.toFixed(2)}%
    - PCE (Process Cycle Efficiency): ${metrics.pce.toFixed(2)}%
    - Bottleneck Station: ${stations.find(s => s.id === metrics.bottleneckStationId)?.name || 'None'}
    
    Stations Details:
    ${stations.map(s => `- ${s.name} (${s.type}): CT=${s.cycleTime}m, FTE=${s.fte}, FlowFactor=${(metrics.flowFactors[s.id] || 0).toFixed(2)}`).join('\n')}
    
    Please provide:
    1. A brief summary of the current performance.
    2. Identification of the primary bottleneck and its impact.
    3. Specific suggestions to improve throughput or efficiency.
    4. A prediction of the impact if suggestions are implemented.
    
    Format the response in clean Markdown.
  `;

  try {
    return await getChatCompletion(prompt, settings);
  } catch (error) {
    console.error("Error generating AI insights:", error);
    return `Error: ${error instanceof Error ? error.message : "Failed to connect to the AI service."}`;
  }
}

export async function analyzeLinePerformance(
  line: AssemblyLine,
  settings: GlobalSettings,
  result: SimulationResult
): Promise<string> {
  const prompt = `
    As an industrial engineering expert, analyze the following dynamic simulation results for the manufacturing line "${line.name}".
    
    Simulation Parameters:
    - Demand: ${settings.demand} units/day
    - Available Time: ${settings.availableHours} hours/day
    
    Simulation Results:
    - Total Output: ${result.totalOutput} units
    - Total Defects: ${result.totalDefects}
    - Total Rework: ${result.totalRework}
    - Yield: ${(((result.totalOutput - result.totalDefects) / (result.totalOutput || 1)) * 100).toFixed(2)}%
    
    Station Performance (Utilization / Starvation / Blockage):
    ${line.stations.map(s => {
      const util = result.stationUtilization[s.id] || 0;
      const starv = result.starvationTime[s.id] || 0;
      const block = result.blockageTime[s.id] || 0;
      return `- ${s.name}: Util=${util.toFixed(1)}%, Starv=${starv.toFixed(1)}%, Block=${block.toFixed(1)}%`;
    }).join('\n')}
    
    Please provide a detailed analysis including:
    1. Overall performance assessment against demand.
    2. Deep dive into the main bottlenecks (high utilization or high blockage).
    3. Analysis of starvation issues (where is the flow breaking?).
    4. Impact of quality (defects/rework) on the final output.
    5. Actionable recommendations for line balancing and optimization.
    
    Format the response in clean Markdown.
  `;

  try {
    return await getChatCompletion(prompt, settings);
  } catch (error) {
    console.error("Error analyzing line performance:", error);
    return `Error: ${error instanceof Error ? error.message : "Failed to connect to the AI service."}`;
  }
}

export async function getBufferSuggestions(
  stations: Station[],
  connections: Connection[],
  metrics: Metrics,
  settings: GlobalSettings
): Promise<string> {
  const prompt = `
    As an industrial engineering expert specializing in Theory of Constraints and Buffer Management, analyze this manufacturing line and suggest optimal inventory buffer locations and sizes.
    
    Line Configuration:
    - Total Stations: ${stations.length}
    - System Takt: ${metrics.systemTakt.toFixed(2)} min/unit
    - Bottleneck: ${stations.find(s => s.id === metrics.bottleneckStationId)?.name || 'None'}
    
    Station Reliability Data (MTBF/MTTR):
    ${stations.map(s => `- ${s.name}: MTBF=${s.mtbf || 'N/A'}m, MTTR=${s.mttr || 'N/A'}m, CT=${s.cycleTime}m`).join('\n')}
    
    Inventory Points:
    ${stations.filter(s => s.type === 'inventory').map(s => `- ${s.name}: Current Capacity=${s.capacity}, Current Target=${s.targetInventory}`).join('\n')}
    
    Please provide:
    1. Strategic Buffer Locations: Where should buffers be placed or increased to protect the bottleneck from upstream/downstream disruptions?
    2. Recommended Buffer Sizes: Calculate suggested capacities based on MTTR and Takt Time.
    3. Rationale: Explain why these locations were chosen (e.g., "protecting the bottleneck", "decoupling high-variability stations").
    4. Risk Analysis: What happens if these buffers are too small?
    
    Format the response in clean Markdown.
  `;

  try {
    return await getChatCompletion(prompt, settings);
  } catch (error) {
    console.error("Error generating buffer suggestions:", error);
    return `Error: ${error instanceof Error ? error.message : "Failed to connect to the AI service."}`;
  }
}
