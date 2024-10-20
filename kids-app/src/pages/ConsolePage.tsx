/**
 * Running a local relay server will allow you to hide your API key
 * and run custom logic on the server
 *
 * Set the local relay server address to:
 * REACT_APP_LOCAL_RELAY_SERVER_URL=http://localhost:8081
 *
 * This will also require you to set OPENAI_API_KEY= in a `.env` file
 * You can run it with `npm run relay`, in parallel with `npm start`
 */
const LOCAL_RELAY_SERVER_URL: string =
  process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || '';

import { useEffect, useRef, useCallback, useState } from 'react';
import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import { instructions as originalInstructions } from '../utils/conversation_config';
import { WavRenderer } from '../utils/wav_renderer';
import { X, Edit, Zap, ArrowUp, ArrowDown } from 'react-feather';
import { Button } from '../components/button/Button';
import { Toggle } from '../components/toggle/Toggle';
import { captureImage, saveImage, getMostRecentImage } from '../utils/imageCapture';
import './ConsolePage.scss';
import { analyzeImage } from '../utils/visionApi';
import AWS from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid';
import { Buffer } from 'buffer';

/**
 * Represents information about a captured image.
 */
interface ImageInfo {
  url: string;
  timestamp: number;
}

/**
 * Combines a conversation item with its associated images.
 */
interface ConversationWithImages {
  conversationItem: ItemType;
  images: ImageInfo[];
}

/**
 * Type for all event logs
 */
interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  count?: number;
  event: { [key: string]: any };
}

/**
 * Type for NG list item
 */
interface NGListItem {
  userId: string;
  ngWord: string;
}

const s3 = new AWS.S3({
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
  region: process.env.REACT_APP_AWS_REGION,
});

const dynamoDb = new AWS.DynamoDB.DocumentClient({        
  region: process.env.REACT_APP_AWS_REGION,
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY
});

// 会話履歴をS3に保存する関数
const saveConversationToS3 = async (conversationItems: ConversationWithImages[]) => {
  // 環境変数のチェック
  const bucketName = process.env.REACT_APP_AWS_BUCKET_NAME;
  const accessKeyId = process.env.REACT_APP_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.REACT_APP_AWS_SECRET_ACCESS_KEY;
  const region = process.env.REACT_APP_AWS_REGION;

  // Mock user id
  const userId = '1';

  // 必要な環境変数が設定されていない場合は処理をスキップ
  if (!bucketName || !accessKeyId || !secretAccessKey || !region) {
    console.warn("Skipping S3 upload: One or more required environment variables are not set.");
    return;
  }

  // formattedプロパティを除外し、画像情報を含める
  const filteredItems = conversationItems.map(({ conversationItem, images }) => {
    const { formatted, ...rest } = conversationItem;
    return { ...rest, images };
  });


  const params = {
    Bucket: bucketName,
    Key: `conversations/${userId}/${Date.now()}.json`,
    Body: JSON.stringify(filteredItems),
    ContentType: 'application/json',
  };

  try {
    await s3.putObject(params).promise();
    console.log('Conversation saved to S3 successfully.');
  } catch (error) {
    console.error('Error saving conversation to S3:', error);
  }
};

const uploadImageToS3 = async (imageData: string): Promise<string | null> => {
  const bucketName = process.env.REACT_APP_AWS_IMAGE_BUCKET_NAME;
  if (!bucketName) {
    console.error('AWS bucket name is not set');
    return null;
  }
  // Mock user id
  const userId = '1';
  const fileName = `images/${userId}/${uuidv4()}.jpg`;
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
  const params = {
    Bucket: bucketName,
    Key: fileName,
    Body: Buffer.from(base64Data, 'base64'),
    ContentType: 'image/jpeg',
  };

  try {
    const { Location } = await s3.upload(params).promise();
    return Location || null;
  } catch (error) {
    console.error('Error uploading image to S3:', error);
    return null;
  }
};

export function ConsolePage() {
  useEffect(() => {
    const clearLocalStorage = () => {
      localStorage.clear();
      console.log('Local storage cleared on refresh');
    };
    window.addEventListener('beforeunload', clearLocalStorage);
    return () => {
      window.removeEventListener('beforeunload', clearLocalStorage);
    };
  }, []);

  const apiKey = LOCAL_RELAY_SERVER_URL
  ? ''
  : process.env.REACT_APP_OPENAI_API_KEY || '';

  if (!apiKey && !LOCAL_RELAY_SERVER_URL) {
    console.error('OpenAI API Key is not set in the environment variables');
  }

  /**
   * Instantiate:
   * - WavRecorder (speech input)
   * - WavStreamPlayer (speech output)
   * - RealtimeClient (API client)
   */
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient(
      LOCAL_RELAY_SERVER_URL
        ? { url: LOCAL_RELAY_SERVER_URL }
        : {
            apiKey: apiKey,
            dangerouslyAllowAPIKeyInBrowser: true,
          }
    )
  );

  /**
   * References for
   * - Rendering audio visualization (canvas)
   * - Autoscrolling event logs
   * - Timing delta for event log displays
   */
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  /**
   * Camera capture state
   */
  const [isCameraCapturing, setIsCameraCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /**
   * All of our variables for displaying application state
   * - items are all conversation items (dialog)
   * - realtimeEvents are event logs, which can be expanded
   * - memoryKv is for set_memory() function
   * - coords, marker are for get_weather() function
   */
  const [items, setItems] = useState<ConversationWithImages[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<{
    [key: string]: boolean;
  }>({});
  const [isConnected, setIsConnected] = useState(false);
  const [canPushToTalk, setCanPushToTalk] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [memoryKv, setMemoryKv] = useState<{ [key: string]: any }>({});
  const [ngWords, setNgWords] = useState<string[]>([]);
  const [instructions, setInstructions] = useState(originalInstructions);

  /**
   * Utility for formatting the timing of logs
   */
  const formatTime = useCallback((timestamp: string) => {
    const startTime = startTimeRef.current;
    const t0 = new Date(startTime).valueOf();
    const t1 = new Date(timestamp).valueOf();
    const delta = t1 - t0;
    const hs = Math.floor(delta / 10) % 100;
    const s = Math.floor(delta / 1000) % 60;
    const m = Math.floor(delta / 60_000) % 60;
    const pad = (n: number) => {
      let s = n + '';
      while (s.length < 2) {
        s = '0' + s;
      }
      return s;
    };
    return `${pad(m)}:${pad(s)}.${pad(hs)}`;
  }, []);

  /**
   * Connect to conversation:
   * WavRecorder taks speech input, WavStreamPlayer output, client is API client
   */
  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    // Set state variables
    startTimeRef.current = new Date().toISOString();
    setIsConnected(true);
    setRealtimeEvents([]);
    setItems(client.conversation.getItems().map((item: ItemType) => ({
      conversationItem: item,
      images: []
    })));

    // Connect to microphone
    await wavRecorder.begin();

    // Connect to audio output
    await wavStreamPlayer.connect();

    // Connect to realtime API
    await client.connect();
    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Hello!`,
      },
    ]);

    if (client.getTurnDetectionType() === 'server_vad') {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
  }, []);

  /**
   * Disconnect and reset conversation state
   */
  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setRealtimeEvents([]);
    setItems([]);
    setMemoryKv({});
    const client = clientRef.current;
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();

    await saveConversationToS3(items);
  }, [items]);

  const deleteConversationItem = useCallback(async (id: string) => {
    const client = clientRef.current;
    client.deleteItem(id);
  }, []);

  /**
   * In push-to-talk mode, start recording
   * .appendInputAudio() for each sample
   */
  const startRecording = async () => {
    setIsRecording(true);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      await client.cancelResponse(trackId, offset);
    }
    await wavRecorder.record((data) => client.appendInputAudio(data.mono));
  };

  /**
   * In push-to-talk mode, stop recording
   */
  const stopRecording = async () => {
    setIsRecording(false);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.pause();
    client.createResponse();
  };

  /**
   * Switch between Manual <> VAD mode for communication
   */
  const changeTurnEndType = async (value: string) => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    if (value === 'none' && wavRecorder.getStatus() === 'recording') {
      await wavRecorder.pause();
    }
    client.updateSession({
      turn_detection: value === 'none' ? null : { type: 'server_vad' },
    });
    if (value === 'server_vad' && client.isConnected()) {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
    setCanPushToTalk(value === 'none');
  };

  /**
   * Toggle camera capture
   */
  const toggleCameraCapture = useCallback(async () => {
    if (isCameraCapturing) {
      setIsCameraCapturing(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          streamRef.current = stream;
          setIsCameraCapturing(true);
        } else {
          console.error('videoRef is null');
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
      }
    }
  }, [isCameraCapturing]);

  const saveImageInfoToConversation = (imageUrl: string, timestamp: number) => {
    setItems(prevItems => {
      const newItems = prevItems.map((item, index) => {
        if (index === prevItems.length - 1) {
          return {
            ...item,
            images: [...(item.images || []), { url: imageUrl, timestamp }]
          };
        }
        return item;
      });
      console.log('Updated items:', newItems);
      return newItems;
    });
  };
  /**
   * Auto-scroll the event logs
   */
  useEffect(() => {
    if (eventsScrollRef.current) {
      const eventsEl = eventsScrollRef.current;
      const scrollHeight = eventsEl.scrollHeight;
      // Only scroll if height has just changed
      if (scrollHeight !== eventsScrollHeightRef.current) {
        eventsEl.scrollTop = scrollHeight;
        eventsScrollHeightRef.current = scrollHeight;
      }
    }
  }, [realtimeEvents]);

  /**
   * Auto-scroll the conversation logs
   */
  useEffect(() => {
    const conversationEls = [].slice.call(
      document.body.querySelectorAll('[data-conversation-content]')
    );
    for (const el of conversationEls) {
      const conversationEl = el as HTMLDivElement;
      conversationEl.scrollTop = conversationEl.scrollHeight;
    }
  }, [items]);


  /**
   * Capture images from the camera every 5 seconds
   */
  useEffect(() => {
    let captureInterval: NodeJS.Timeout;

    if (isCameraCapturing && videoRef.current) {
      captureInterval = setInterval(async () => {
        const imageData = captureImage(videoRef.current!);
        if (imageData) {
          try {
            saveImage(imageData);
            const imageUrl = await uploadImageToS3(imageData);
            if (imageUrl) {
              const timestamp = Date.now();
              saveImageInfoToConversation(imageUrl, timestamp);
            } else {
              console.error('Failed to upload image: No URL returned');
            }
          } catch (error) {
            console.error('Failed to upload image:', error);
          }
        }
      }, 5000);
    }

    return () => {
      if (captureInterval) {
        clearInterval(captureInterval);
      }
    };
  }, [isCameraCapturing]);

  /**
   * Set up render loops for the visualization canvas
   */
  useEffect(() => {
    let isLoaded = true;

    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;

    const wavStreamPlayer = wavStreamPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;
    let serverCtx: CanvasRenderingContext2D | null = null;

    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width = clientCanvas.offsetWidth;
            clientCanvas.height = clientCanvas.offsetHeight;
          }
          clientCtx = clientCtx || clientCanvas.getContext('2d');
          if (clientCtx) {
            clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              clientCanvas,
              clientCtx,
              result.values,
              '#0099ff',
              10,
              0,
              8
            );
          }
        }
        if (serverCanvas) {
          if (!serverCanvas.width || !serverCanvas.height) {
            serverCanvas.width = serverCanvas.offsetWidth;
            serverCanvas.height = serverCanvas.offsetHeight;
          }
          serverCtx = serverCtx || serverCanvas.getContext('2d');
          if (serverCtx) {
            serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
            const result = wavStreamPlayer.analyser
              ? wavStreamPlayer.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              serverCanvas,
              serverCtx,
              result.values,
              '#009900',
              10,
              0,
              8
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      isLoaded = false;
    };
  }, []);

  const fetchNGList = useCallback(async () => {
    const params = {
      TableName: process.env.REACT_APP_NG_LIST_TABLE_NAME || '',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': '1', // Assuming '1' is the userId, adjust as needed
      },
    };
    try {
      const result = await dynamoDb.query(params).promise();
      if (result.Items) {
        const words = result.Items.map((item) => (item as NGListItem).ngWord);
        setNgWords(words);
      }
    } catch (error) {
      console.error('Error fetching NG list:', error);
    }
  }, []);

  const updateInstructions = useCallback(() => {
    if (ngWords.length > 0) {
      const updatedInstructions = `${originalInstructions}

### NG Words:
${ngWords.join(', ')}
`;
      setInstructions(updatedInstructions);
    }
  }, [ngWords]);

  useEffect(() => {
    fetchNGList();
  }, [fetchNGList]);

  useEffect(() => {
    updateInstructions();
  }, [ngWords, updateInstructions]);

  /**
   * Core RealtimeClient and audio capture setup
   * Set all of our instructions, tools, events and more
   */
  useEffect(() => {
    // Get refs
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;

    client.updateSession({ instructions: instructions });
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });
    client.updateSession({ voice: 'echo'});

    client.addTool(
      {
        name: 'set_memory',
        description: 'Saves important data about the user into memory.',
        parameters: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description:
                'The key of the memory value. Always use lowercase and underscores, no other characters.',
            },
            value: {
              type: 'string',
              description: 'Value can be anything represented as a string',
            },
          },
          required: ['key', 'value'],
        },
      },
      async ({ key, value }: { [key: string]: any }) => {
        setMemoryKv((memoryKv) => {
          const newKv = { ...memoryKv };
          newKv[key] = value;
          return newKv;
        });
        return { ok: true };
      }
    );
    client.addTool(
      {
        name: 'analyze_recent_image',
        description: 'Analyzes the most recent captured image using LLM.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      async () => {
        const recentImage = getMostRecentImage();
        if (!recentImage) {
          return { error: "No recent image found." };
        }
        const analysis = await analyzeImage(recentImage);
        return { analysis };
      }
    );
    
    // handle realtime events from client + server for event logging
    client.on('realtime.event', (realtimeEvent: RealtimeEvent) => {
      setRealtimeEvents((realtimeEvents) => {
        const lastEvent = realtimeEvents[realtimeEvents.length - 1];
        if (lastEvent?.event.type === realtimeEvent.event.type) {
          // if we receive multiple events in a row, aggregate them for display purposes
          lastEvent.count = (lastEvent.count || 0) + 1;
          return realtimeEvents.slice(0, -1).concat(lastEvent);
        } else {
          return realtimeEvents.concat(realtimeEvent);
        }
      });
    });
    client.on('error', (event: any) => console.error(event));
    client.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });
    client.on('conversation.updated', ({ item, delta }: any) => {
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }

      setItems(prevItems => {
        const updatedItems = client.conversation.getItems().map((newItem: ItemType) => {
          const existingItem = prevItems.find(i => i.conversationItem.id === newItem.id);
          return {
            conversationItem: newItem,
            images: existingItem ? existingItem.images : []
          };
        });
        return updatedItems;
      });

      if (item.status === 'completed' && item.formatted.audio?.length) {
        WavRecorder.decode(item.formatted.audio, 24000, 24000)
          .then(wavFile => {
            setItems(prevItems => {
              return prevItems.map(prevItem => {
                if (prevItem.conversationItem.id === item.id) {
                  return {
                    ...prevItem,
                    conversationItem: {
                      ...prevItem.conversationItem,
                      formatted: {
                        ...prevItem.conversationItem.formatted,
                        file: wavFile
                      }
                    }
                  };
                }
                return prevItem;
              });
            });
          })
          .catch(error => console.error('Error decoding audio:', error));
      }
    });

    setItems(client.conversation.getItems().map((item: ItemType) => ({
      conversationItem: item,
      images: []
    })));

    return () => {
      // cleanup; resets to defaults
      client.reset();
    };
  }, [instructions]); // Add instructions as a dependency

  /**
   * Clean up camera stream when component unmounts
   */
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  /**
   * Render the application
   */
  return (
    <div data-component="ConsolePage">
      <div className="content-top">
        <div className="content-title">
          <img src="/icon_text.svg" alt="Teddy Talk Icon" style={{ width: '100px', height: 'auto' }} />
        </div>
      </div>
      <div className="content-main">
        <div className="content-logs">
          <div className="content-block events">
            <div className="visualization">
              <div className="visualization-entry client">
                <canvas ref={clientCanvasRef} />
              </div>
              <div className="visualization-entry server">
                <canvas ref={serverCanvasRef} />
              </div>
            </div>
            <div className="content-block-title">events</div>
            <div className="content-block-body" ref={eventsScrollRef}>
              {!realtimeEvents.length && `awaiting connection...`}
              {realtimeEvents.map((realtimeEvent, i) => {
                const count = realtimeEvent.count;
                const event = { ...realtimeEvent.event };
                if (event.type === 'input_audio_buffer.append') {
                  event.audio = `[trimmed: ${event.audio.length} bytes]`;
                } else if (event.type === 'response.audio.delta') {
                  event.delta = `[trimmed: ${event.delta.length} bytes]`;
                }
                return (
                  <div className="event" key={event.event_id}>
                    <div className="event-timestamp">
                      {formatTime(realtimeEvent.time)}
                    </div>
                    <div className="event-details">
                      <div
                        className="event-summary"
                        onClick={() => {
                          // toggle event details
                          const id = event.event_id;
                          const expanded = { ...expandedEvents };
                          if (expanded[id]) {
                            delete expanded[id];
                          } else {
                            expanded[id] = true;
                          }
                          setExpandedEvents(expanded);
                        }}
                      >
                        <div
                          className={`event-source ${
                            event.type === 'error'
                              ? 'error'
                              : realtimeEvent.source
                          }`}
                        >
                          {realtimeEvent.source === 'client' ? (
                            <ArrowUp />
                          ) : (
                            <ArrowDown />
                          )}
                          <span>
                            {event.type === 'error'
                              ? 'error!'
                              : realtimeEvent.source}
                          </span>
                        </div>
                        <div className="event-type">
                          {event.type}
                          {count && ` (${count})`}
                        </div>
                      </div>
                      {!!expandedEvents[event.event_id] && (
                        <div className="event-payload">
                          {JSON.stringify(event, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="content-block conversation">
            <div className="content-block-title">conversation</div>
            <div className="content-block-body" data-conversation-content>
              {!items.length && `awaiting connection...`}
              {items.map((conversationWithImages, i) => {
                const conversationItem = conversationWithImages.conversationItem;
                return (
                  <div className="conversation-item" key={conversationItem.id}>
                    <div className={`speaker ${conversationItem.role || ''}`}>
                      <div>
                        {(
                          conversationItem.role || conversationItem.type
                        ).replaceAll('_', ' ')}
                      </div>
                      <div
                        className="close"
                        onClick={() =>
                          deleteConversationItem(conversationItem.id)
                        }
                      >
                        <X />
                      </div>
                    </div>
                    <div className={`speaker-content`}>
                      {/* tool response */}
                      {conversationItem.type === 'function_call_output' && (
                        <div>{conversationItem.formatted.output}</div>
                      )}
                      {/* tool call */}
                      {!!conversationItem.formatted.tool && (
                        <div>
                          {conversationItem.formatted.tool.name}(
                          {conversationItem.formatted.tool.arguments})
                        </div>
                      )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'user' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              (conversationItem.formatted.audio?.length
                                ? '(awaiting transcript)'
                                : conversationItem.formatted.text ||
                                  '(item sent)')}
                          </div>
                        )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'assistant' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              conversationItem.formatted.text ||
                              '(truncated)'}
                          </div>
                        )}
                      {conversationItem.formatted.file && (
                        <audio
                          src={conversationItem.formatted.file.url}
                          controls
                        />
                      )}
                    </div>
                    {conversationWithImages.images.length > 0 && (
                      <div className="image-info">
                        {conversationWithImages.images.map((image, index) => (
                          <div key={index}>
                            <img src={image.url} alt={`Captured at ${new Date(image.timestamp).toLocaleString()}`} style={{width: '100px', height: 'auto'}} />
                            <p>Captured at: {new Date(image.timestamp).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="content-actions">
            <Toggle
              defaultValue={false}
              labels={['manual', 'vad']}
              values={['none', 'server_vad']}
              onChange={(_, value) => changeTurnEndType(value)}
            />
            <div className="spacer" />
            {isConnected && canPushToTalk && (
              <Button
                label={isRecording ? 'release to send' : 'push to talk'}
                buttonStyle={isRecording ? 'alert' : 'regular'}
                disabled={!isConnected || !canPushToTalk}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
              />
            )}
            <div className="spacer" />
            <Button
              label={isCameraCapturing ? 'Stop Camera' : 'Start Camera'}
              onClick={() => {
                toggleCameraCapture();
              }}
            />
            <div className="spacer" />
            <Button
              label={isConnected ? 'disconnect' : 'connect'}
              iconPosition={isConnected ? 'end' : 'start'}
              icon={isConnected ? X : Zap}
              buttonStyle={isConnected ? 'regular' : 'action'}
              onClick={
                isConnected ? disconnectConversation : connectConversation
              }
            />
          </div>
        </div>
        <div className="content-right">
          <div className="content-block kv">
            <div style={{ color: isCameraCapturing ? 'green' : 'red', marginBottom: '10px' }}>
              Camera status: {isCameraCapturing ? 'Active' : 'Inactive'}
            </div>
            <video 
              ref={videoRef} 
              style={{ 
                width: '300px', 
                height: '225px', 
                objectFit: 'cover',
                display: isCameraCapturing ? 'block' : 'none' 
              }} 
              autoPlay 
              playsInline 
              muted
            />
          </div>
          {/* <div className="content-block kv">
            <div className="content-block-title">set_memory()</div>
            <div className="content-block-body content-kv">
              {JSON.stringify(memoryKv, null, 2)}
            </div>
          </div> */}
        </div>
      </div>
    </div>
  );
}
