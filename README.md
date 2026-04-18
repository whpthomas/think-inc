# Think-Inc OpenCode Plugin

[![npm version](https://badge.fury.io/js/think-inc.svg)](https://www.npmjs.com/package/think-inc)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What Is This?

Think-Inc is an simple OpenCode plugin that injects thinking traces back into the message context. It captures the reasoning parts as they stream in, stores them temporarily, then injects them back into message context so the model can see its thinking process.

## Why Use This?

To improve model self efficacy when workflows spawn new contexts as a first class construct:

- Ralph Loops
- Research -> Plan -> Implement (RPI) Workflows
- Questions -> Research -> Design -> Structure -> Plan -> Implement (QRSPI) Workflows
- Acceptance Criteria -> Implement <-> Validate (GAN) Loops

## How It Works

The plugin works in three stages:

1. **Capture**: Listens for `message.part.updated` events and accumulates reasoning chunks
2. **Store**: Maintains session-based storage for reasoning data across streaming events
3. **Inject**: Uses the `experimental.chat.messages.transform` hook to prepend reasoning blocks to messages

## Quick Start

## Installation

Add to your `opencode.json`:

```json
{
  "plugin": ["think-inc"]
}
```

### AGENTS.md

Include the following section in AGENTS.md

```markdown
## Reasoning

The Think-Inc OpenCode plugin is providing thinking traces inside `<reasoning>` blocks in your context. It provides transparency to understand your thinking process and reduce repetition. Follow these guidelines to reduce context duplication:

- Assume the reader has seen reasoning
- Keep final response concise and action-oriented
- Focus on deliverables, decisions, and next steps
- Don't repeat reasoning content in response
- Don't provide verbose explanations when reasoning covers thinking
- Don't add unnecessary preamble or restatement of the approach
```

## License

MIT

## Authors

- [@whpthomas](https://github.com/whpthomas) - Concept, logic and troubleshooting
- Qwen3.5 122B A10B int4 AutoRound ~ DGX Spark - Research and coding
