import { GoogleGenAI } from "@google/genai";
import { Station, Connection, Metrics, GlobalSettings, AssemblyLine, SimulationResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text || "Unable to generate insights at this time.";
  } catch (error) {
    console.error("Error generating AI insights:", error);
    return "Error: Failed to connect to the AI service. Please check your configuration.";
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
    - Yield: ${(((result.totalOutput - result.totalDefects) / result.totalOutput) * 100).toFixed(2)}%
    
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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text || "Unable to generate analysis at this time.";
  } catch (error) {
    console.error("Error analyzing line performance:", error);
    return "Error: Failed to connect to the AI service. Please check your configuration.";
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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text || "Unable to generate buffer suggestions at this time.";
  } catch (error) {
    console.error("Error generating buffer suggestions:", error);
    return "Error: Failed to connect to the AI service. Please check your configuration.";
  }
}
