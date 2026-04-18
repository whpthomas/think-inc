/**
 * Think-Inc Plugin - Reasoning Block Interceptor
 * 
 * Captures reasoning parts as they stream in, stores them temporarily,
 * then injects them back into message context for the next turn.
 */

import type { Plugin, Hooks, PluginInput } from '@opencode-ai/plugin';
import { log, clearLog, flush } from './logger.js';

/**
 * Store reasoning per session with completion tracking
 * 
 * Reasoning arrives via streaming events, but needs to persist until
 * the transform hook runs to inject it into message context.
 */
interface ReasoningStore {
  reasoning: Map<string, string[]>;  // messageID -> reasoning chunks (accumulating)
  complete: Set<string>;             // messageIDs that have finished streaming
}

// Global store: sessionID -> ReasoningStore
// Needed because reasoning chunks arrive asynchronously and must persist
// until the transform hook runs to inject them into context.
const sessionStores = new Map<string, ReasoningStore>();

/**
 * Main plugin implementation
 */
export const thoughtsIncPlugin: Plugin = async (_input: PluginInput): Promise<Hooks> => {
  clearLog();
  log('=== Think-Inc Plugin Initialized ===');

  const hooks: Hooks = {
    /**
     * Event Hook: Capture reasoning chunks as they stream in
     * 
     * Triggered on every event from the model. We listen for 'message.part.updated'
     * events where the part type is 'reasoning'. Each chunk is accumulated in
     * sessionStores so it can be injected later when the message context is built.
     */
    event: async ({ event }) => {
      if (event.type !== 'message.part.updated') return;

      const properties = event.properties as any;
      const part = properties.part;

      // Only capture reasoning parts
      if (part.type !== 'reasoning') return;
      if (!part.text?.trim()) return;

      const messageID = part.messageID;
      const sessionID = part.sessionID;
      const preview = part.text.slice(0, 35).replace(/\n/g, '\\n');
      log(`[CAPTURE] "${preview}..." ${part.text.length} chars`);

      // Initialize or get session store
      if (!sessionStores.has(sessionID)) {
        sessionStores.set(sessionID, {
          reasoning: new Map(),
          complete: new Set()
        });
      }
      const store = sessionStores.get(sessionID)!;

      // Initialize message array if needed
      if (!store.reasoning.has(messageID)) {
        store.reasoning.set(messageID, []);
      }

      // Add reasoning chunk to accumulate all pieces
      store.reasoning.get(messageID)!.push(part.text);
    },

    /**
     * Transform Hook: Inject captured reasoning into message context
     * 
     * This runs when building the message context for the next turn. We:
     * 1. Look up any captured reasoning for each message from sessionStores
     * 2. Combine all chunks into full reasoning text
     * 3. Inject it as <reasoning> tags at the top of the first text part
     * 4. Mark as complete and clean up to prevent re-injection
     * 
     * Iterates backwards from the most recent message since that's where
     * new reasoning would be. Stops after injection to avoid unnecessary processing.
     */
    'experimental.chat.messages.transform': async (_input, output) => {
      log(`[TRANSFORM] Processing ${output.messages.length} messages`);

      // Get sessionID once from the first message - same session for all messages in this transform
      const sessionID = output.messages[0]?.info?.sessionID;
      if (!sessionID) {
        log('[TRANSFORM] No sessionID available');
        return output;
      }

      const store = sessionStores.get(sessionID);
      if (!store) {
        log(`[TRANSFORM] No store for session ${sessionID}`);
        return output;
      }

      // Iterate backwards from most recent message
      for (let i = output.messages.length - 1; i >= 0; i--) {
        const msg = output.messages[i];
        const messageID = msg.info.id;

        if (!store.reasoning.has(messageID)) {
          continue;
        }

        if (store.complete.has(messageID)) {
          log(`[TRANSFORM] Message ${messageID} already completed`);
          break;
        }

        // Combine all streaming chunks into complete reasoning text
        const combinedReasoning = store.reasoning.get(messageID)!
          .filter(r => r.trim())
          .join('\n');

        if (combinedReasoning.trim()) {
          // Inject reasoning as a new text part at the beginning of the message
          // This works even for tool-only messages that have no existing text parts
          const reasoningPart: any = {
            type: 'text',
            text: `Reasoning: ${combinedReasoning}\n\n---\n`,
            synthetic: true,
            id: `reasoning-${messageID}`,
            sessionID: sessionID,
            messageID: messageID,
          };
          // Insert reasoning part at the beginning of the message
          msg.parts.unshift(reasoningPart);

          log(`[INJECT] ${combinedReasoning.length} chars ${messageID} ${sessionID}`);
        }

        store.complete.add(messageID);
        store.reasoning.delete(messageID);

        // Stop after first injection - newer messages processed first
        break;
      }

      // Cleanup: remove sessions with no pending reasoning (outside the loop)
      if (store.reasoning.size === 0 && store.complete.size > 0) {
        sessionStores.delete(sessionID);
        log(`[CLEANUP] Session ${sessionID} cleaned up`);
        await flush();
      }

      return output;
    },
  };

  return hooks;
};

export default thoughtsIncPlugin;
