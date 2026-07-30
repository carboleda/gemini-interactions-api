import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({});

async function createAgent() {
    const interaction = await client.interactions.create(
      {
        agent: "antigravity-preview-05-2026",
        input:
          "Look for the USD to COP exchange rate for the last 10 days, analyze the behavior and generate a forecast for the next 3 days, finally save the results as a PDF.",
        environment: "remote",
        background: true,
      },
      //   { timeout: 300000 },
    );

    const interac = await client.interactions.get(interaction.id);
    console.log(interac);

    console.log(interaction.id, interaction.output_text);
    console.log(interaction);
}

async function listAgents() {
    const agents = await client.agents.list();
    console.log("agents", agents);
    if (agents.agents) {
        for (const a of agents.agents) {
            console.log(`${a.id}: ${a.description}`);
        }
    }
}

createAgent();
// listAgents();
