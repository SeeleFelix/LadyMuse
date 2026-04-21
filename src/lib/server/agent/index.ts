import { streamText, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { buildSystemPrompt } from './system-prompt';
import { allTools } from './tools';
import { getConfig } from '../config';
import { getProvider } from '../providers';

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-6';

interface Message {
	role: 'user' | 'assistant';
	content: string;
	image?: string;
}

export async function* chatStream(
	messages: Message[],
	modelId?: string,
	providerId?: string
) {
	const resolvedModel = modelId || (await getConfig('default_model')) || DEFAULT_MODEL;
	const resolvedProvider = providerId || 'openrouter';

	const provider = getProvider(resolvedProvider);
	if (!provider) {
		yield JSON.stringify({ type: 'error', content: `未知提供商 "${resolvedProvider}"` }) + '\n';
		return;
	}

	const apiKey = await getConfig(provider.apiKeyConfigKey);
	if (!apiKey) {
		yield JSON.stringify({ type: 'error', content: `请先配置 ${provider.name} API Key` }) + '\n';
		return;
	}

	let model;
	if (provider.id === 'deepseek') {
		const deepseek = createDeepSeek({ apiKey });
		model = deepseek(resolvedModel);
	} else {
		const client = createOpenAI({
			baseURL: provider.baseURL,
			apiKey,
		});
		model = client.chat(resolvedModel);
	}

	const formattedMessages = messages.map((m): any => {
		if (m.image) {
			return {
				role: m.role,
				content: [
					{ type: 'text' as const, text: m.content },
					{ type: 'image' as const, image: m.image }
				]
			};
		}
		return { role: m.role, content: m.content };
	});

	const result = streamText({
		model,
		system: buildSystemPrompt(),
		messages: formattedMessages,
		tools: allTools,
		stopWhen: stepCountIs(10),
	});

	let gotText = false;

	try {
		for await (const event of result.fullStream) {
			if (event.type === 'text-delta') {
				gotText = true;
				yield JSON.stringify({ type: 'text', content: event.text }) + '\n';
			} else if (event.type === 'tool-call') {
				yield JSON.stringify({ type: 'tool-call', name: event.toolName, input: event.input }) + '\n';
			} else if (event.type === 'tool-result') {
				const output = typeof event.output === 'string' ? event.output : JSON.stringify(event.output);
				yield JSON.stringify({ type: 'tool-result', name: event.toolName, output: output.slice(0, 500) }) + '\n';
			}
		}

		// Fallback: if fullStream didn't emit text-delta, get from result.text promise
		if (!gotText) {
			const finalText = await result.text;
			if (finalText) {
				yield JSON.stringify({ type: 'text', content: finalText }) + '\n';
			}
		}
	} catch (e: any) {
		yield JSON.stringify({ type: 'error', content: e.message }) + '\n';
	}
}

export { DEFAULT_MODEL };
