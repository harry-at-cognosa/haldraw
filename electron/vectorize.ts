import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import type { VectorizeRequest, VectorizeResponse, VectorizeResult } from '@shared/types';

const KEYCHAIN_SERVICE = 'haldraw';
const KEYCHAIN_ACCOUNT = 'anthropic-api-key';

/** The command the user runs once to store the key; shown verbatim in error messages. */
export const KEYCHAIN_ADD_COMMAND = `security add-generic-password -s ${KEYCHAIN_SERVICE} -a ${KEYCHAIN_ACCOUNT} -w '<your key>' -U`;

/** Read the key from the macOS keychain at call time. Never cached, never logged. */
function readApiKey(): string | null {
  const r = spawnSync('security', ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT, '-w'], {
    encoding: 'utf8',
    timeout: 5000,
  });
  if (r.status !== 0) return null;
  const key = (r.stdout ?? '').trim();
  return key.length ? key : null;
}

export function hasApiKey(): boolean {
  return readApiKey() !== null;
}

export class VectorizeError extends Error {
  constructor(message: string, public readonly kind: 'no-key' | 'auth' | 'network' | 'model' | 'output') {
    super(message);
  }
}

const SYSTEM_PROMPT = `You convert a raster picture of a diagram (flowchart, data-flow diagram, architecture sketch, org chart, logo with text) into an editable first draft for a drawing tool.

Return every visible shape and every visible connector, as JSON matching the given schema. Coordinates are pixels of the supplied image, origin top-left, x/y the top-left corner of the element's bounding box, w/h its size.

Rules:
- Each box, circle, rounded rectangle or diamond is one shape. Classify as rect, ellipse or diamond; use rect when unsure.
- Free-standing text that is not inside a shape is a shape of kind "text" whose box is the text's extent.
- Text inside a shape goes in that shape's "text" field, exactly as written, line breaks as \\n. Use "" when the shape has no text.
- Colours as 6-digit lowercase hex (#rrggbb): "fill" is the shape's interior, "stroke" its outline, "textColor" the colour of its text (white text on a dark shape is common; report it). Use "" when you cannot tell. Do not invent colours.
- A connector is a line or arrow that visibly joins two shapes; "from" and "to" are the shape ids at its ends, "headEnd" is "arrow" when the "to" end has an arrowhead. A line whose ends do not touch shapes is not a connector; omit it.
- "confidence" is your 0–1 estimate that the element is real and correctly placed.
- Ids are short unique strings such as s1, s2.
- Do not describe the image; output only the JSON object.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['shapes', 'connectors'],
  properties: {
    shapes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'kind', 'x', 'y', 'w', 'h', 'text', 'fill', 'stroke', 'textColor', 'confidence'],
        properties: {
          id: { type: 'string' },
          kind: { type: 'string', enum: ['rect', 'ellipse', 'diamond', 'text'] },
          x: { type: 'number' },
          y: { type: 'number' },
          w: { type: 'number' },
          h: { type: 'number' },
          text: { type: 'string' },
          fill: { type: 'string' },
          stroke: { type: 'string' },
          textColor: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
    },
    connectors: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['from', 'to', 'headEnd', 'label', 'confidence'],
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          headEnd: { type: 'string', enum: ['none', 'arrow'] },
          label: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
    },
  },
} as const;

/** Structural validation of the model's JSON; returns an error message or null. */
export function validateResult(raw: unknown, width: number, height: number): string | null {
  if (!raw || typeof raw !== 'object') return 'Output is not an object.';
  const r = raw as Partial<VectorizeResult>;
  if (!Array.isArray(r.shapes)) return 'Missing "shapes" array.';
  if (!Array.isArray(r.connectors)) return 'Missing "connectors" array.';
  const ids = new Set<string>();
  for (const [i, s] of r.shapes.entries()) {
    if (!s || typeof s.id !== 'string' || !s.id) return `Shape ${i}: missing id.`;
    if (ids.has(s.id)) return `Shape ${i}: duplicate id "${s.id}".`;
    ids.add(s.id);
    if (!['rect', 'ellipse', 'diamond', 'text'].includes(s.kind)) return `Shape ${s.id}: unknown kind "${String(s.kind)}".`;
    for (const k of ['x', 'y', 'w', 'h'] as const) {
      if (typeof s[k] !== 'number' || !Number.isFinite(s[k])) return `Shape ${s.id}: ${k} must be a number.`;
    }
    if (s.w <= 0 || s.h <= 0) return `Shape ${s.id}: w and h must be positive.`;
    if (s.x + s.w < 0 || s.y + s.h < 0 || s.x > width || s.y > height) return `Shape ${s.id}: box lies outside the image (${width}×${height}).`;
  }
  for (const [i, c] of r.connectors.entries()) {
    if (!c || !ids.has(c.from)) return `Connector ${i}: "from" is not a shape id.`;
    if (!ids.has(c.to)) return `Connector ${i}: "to" is not a shape id.`;
    if (c.from === c.to) return `Connector ${i}: from and to are the same shape.`;
  }
  return null;
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

export async function runVectorize(req: VectorizeRequest): Promise<VectorizeResponse> {
  // Test seam: HALDRAW_VECTORIZE_FAKE=<json file> returns that result with no
  // network call. Only a launcher that sets the variable sees this; a packaged
  // app opened from the Finder never has it.
  const fake = process.env.HALDRAW_VECTORIZE_FAKE;
  if (fake) {
    const raw = JSON.parse(readFileSync(fake, 'utf8'));
    const problem = validateResult(raw, req.width, req.height);
    if (problem) throw new VectorizeError(`Fake result rejected: ${problem}`, 'output');
    return { result: raw as VectorizeResult, model: 'fake', inputTokens: 0, outputTokens: 0 };
  }
  const apiKey = readApiKey();
  if (!apiKey) {
    throw new VectorizeError(`No API key in the keychain. In Terminal, run:\n${KEYCHAIN_ADD_COMMAND}`, 'no-key');
  }
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 180_000 });
  const userContent: Anthropic.ContentBlockParam[] = [
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: req.pngBase64 } },
    { type: 'text', text: `The image is ${req.width} × ${req.height} pixels. Extract its shapes and connectors.` },
  ];
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userContent }];
  let inputTokens = 0;
  let outputTokens = 0;

  for (let attempt = 0; attempt < 2; attempt++) {
    let message: Anthropic.Message;
    try {
      message = await client.messages.create({
        model: req.model,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages,
        output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA as unknown as Record<string, unknown> } },
      });
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) throw new VectorizeError('The API key was rejected (401). Check the keychain item.', 'auth');
      if (err instanceof Anthropic.NotFoundError) throw new VectorizeError(`Model "${req.model}" was not found. Pick another in Settings.`, 'model');
      if (err instanceof Anthropic.RateLimitError) throw new VectorizeError('Rate limited by the API. Try again in a minute.', 'network');
      if (err instanceof Anthropic.APIConnectionError) throw new VectorizeError('Could not reach the API. Check the network connection.', 'network');
      if (err instanceof Anthropic.APIError) throw new VectorizeError(`API error ${err.status ?? ''}: ${err.message}`, 'model');
      throw err;
    }
    inputTokens += message.usage.input_tokens;
    outputTokens += message.usage.output_tokens;
    if (message.stop_reason === 'refusal') throw new VectorizeError('The model declined to process this image.', 'model');
    if (message.stop_reason === 'max_tokens') throw new VectorizeError('The model ran out of output tokens before finishing; try a simpler image.', 'output');
    const text = textOf(message);
    let parsed: unknown;
    let problem: string | null;
    try {
      parsed = JSON.parse(text);
      problem = validateResult(parsed, req.width, req.height);
    } catch (err) {
      problem = `Not valid JSON: ${(err as Error).message}`;
    }
    if (!problem) return { result: parsed as VectorizeResult, model: message.model, inputTokens, outputTokens };
    if (attempt === 0) {
      // One retry with the validation error appended, as the design note specifies.
      messages.push({ role: 'assistant', content: text.length ? text : '{}' });
      messages.push({ role: 'user', content: `That output was rejected: ${problem}\nReturn the corrected JSON object only.` });
      continue;
    }
    throw new VectorizeError(`The model's output could not be used: ${problem}\n\n${text.slice(0, 400)}`, 'output');
  }
  throw new VectorizeError('Vectorize failed.', 'output');
}
