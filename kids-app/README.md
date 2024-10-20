# AI-Powered Child Development App

## Table of Contents

- [AI-Powered Child Development App](#ai-powered-child-development-app)
  - [Table of Contents](#table-of-contents)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Environment Setup](#environment-setup)
  - [Using the Console](#using-the-console)
    - [Using a Relay Server](#using-a-relay-server)
  - [Realtime API Reference Client](#realtime-api-reference-client)
    - [Basic Usage](#basic-usage)
    - [Sending Streaming Audio](#sending-streaming-audio)
    - [Adding and Using Tools](#adding-and-using-tools)
    - [Interrupting the Model](#interrupting-the-model)
    - [Reference Client Events](#reference-client-events)
  - [Wavtools](#wavtools)
    - [WavRecorder Quickstart](#wavrecorder-quickstart)
    - [WavStreamPlayer Quickstart](#wavstreamplayer-quickstart)
  - [S3 Storage Functionality](#s3-storage-functionality)
    - [Saving Data to S3](#saving-data-to-s3)

## Getting Started

### Prerequisites

- Node.js
- npm or yarn
- AWS account for S3 and DynamoDB

### Installation

1. Clone the repository
2. Install dependencies for both apps:

```shell
cd kids-app && npm install
cd ../parent-app && npm install
```

### Environment Setup

Create a `.env` file in both the kids-app and parent-app directories with the following variables:

```
REACT_APP_AWS_ACCESS_KEY_ID=your_access_key_id
REACT_APP_AWS_SECRET_ACCESS_KEY=your_secret_access_key
REACT_APP_AWS_REGION=your_aws_region
REACT_APP_AWS_BUCKET_NAME=your_s3_bucket_name
REACT_APP_AWS_IMAGE_BUCKET_NAME=your_s3_image_bucket_name
REACT_APP_OPENAI_API_KEY=your_openai_api_key
REACT_APP_NG_LIST_TABLE_NAME=your_ng_list_table_name
```

Start your server with:

```shell
npm start
```

It should be available via `localhost:3000`.

## Using the Console

To start a session, you need to **connect**. This will require microphone access. You can choose between **manual** (Push-to-talk) and **vad** (Voice Activity Detection) conversation modes, and switch between them at any time.

Two functions are enabled:
- `set_memory`: Ask the model to remember information for you.
- `analyze_recent_image`: Ask the model to analyze the most recent image captured by the camera.

You can freely interrupt the model at any time in push-to-talk or VAD mode.

### Using a Relay Server

For a more robust implementation, you can use the included Node.js [Relay Server](/relay-server/index.js).

```shell
npm run relay
```

It will start automatically on `localhost:8081`. Remember to set up the `.env` file as mentioned in the Environment Setup section.

## Realtime API Reference Client

The latest reference client and documentation are available on GitHub at [openai/openai-realtime-api-beta](https://github.com/openai/openai-realtime-api-beta).

### Basic Usage

```javascript
import { RealtimeClient } from '/src/lib/realtime-api-beta/index.js';

const client = new RealtimeClient({ apiKey: process.env.OPENAI_API_KEY });

// Set up parameters and event handling
client.updateSession({ instructions: 'You are a great, upbeat friend.' });
client.on('conversation.updated', ({ item, delta }) => {
  // Handle conversation updates
});

await client.connect();
client.sendUserMessageContent([{ type: 'text', text: 'How are you?' }]);
```

### Sending Streaming Audio

Use the `.appendInputAudio()` method to send streaming audio. In `turn_detection: 'disabled'` mode, use `.generate()` to trigger a model response.

### Adding and Using Tools

Use `.addTool()` to add tools with callbacks for the model to use.

### Interrupting the Model

Use `client.cancelResponse(id, sampleCount)` to manually interrupt the model.

### Reference Client Events

Main events: 'error', 'conversation.interrupted', 'conversation.updated', 'conversation.item.appended', and 'conversation.item.completed'.

## Wavtools

Wavtools provides easy management of PCM16 audio streams in the browser for recording and playing.

### WavRecorder Quickstart

```javascript
import { WavRecorder } from '/src/lib/wavtools/index.js';

const wavRecorder = new WavRecorder({ sampleRate: 24000 });
await wavRecorder.begin();
await wavRecorder.record((data) => {
  // Handle recorded data
});
```

### WavStreamPlayer Quickstart

```javascript
import { WavStreamPlayer } from '/src/lib/wavtools/index.js';

const wavStreamPlayer = new WavStreamPlayer({ sampleRate: 24000 });
await wavStreamPlayer.connect();
wavStreamPlayer.add16BitPCM(audioData, 'my-track');
```

## S3 Storage Functionality

This project includes functionality to save conversation history to AWS S3.

### Saving Data to S3

Use the `saveConversationToS3` function to save conversation items to S3:

```javascript
const conversationItems = [
  { id: 1, role: 'user', text: 'Hello' },
  { id: 2, role: 'assistant', text: 'Hi! How are you today?' },
];

await saveConversationToS3(conversationItems);
```

Note: Ensure all required environment variables are set correctly for S3 storage to work.