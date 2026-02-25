export const QUEUE_NAMES = {
  COMMANDS: 'commands',
  BROADCASTS: 'broadcasts',
  SCHEDULED: 'scheduled',
  MEDIA: 'media',
  EXTERNAL_API: 'external_api',
} as const;

export const REDIS_KEYS = {
  DEVICE_STATUS: 'device:status:',
  DEVICE_HEARTBEAT: 'device:heartbeat:',
  SESSION_PREFIX: 'session:',
  RATE_LIMIT_PREFIX: 'ratelimit:',
  COMMAND_LOCK: 'command:lock:',
} as const;

export const DEVICE_COMMANDS = {
  OPEN_APP: 'open_app',
  OPEN_URL: 'open_url',
  OPEN_WEBVIEW: 'open_webview',
  PLAY_VIDEO: 'play_video',
  DISPLAY_IMAGE: 'display_image',
  SLIDESHOW: 'slideshow',
  INPUT_TEXT: 'input_text',
  CAPTURE_SCREENSHOT: 'capture_screenshot',
} as const;

export const DEFAULTS = {
  HEARTBEAT_TIMEOUT_MS: 90000,
  HEARTBEAT_INTERVAL_MS: 30000,
  BROADCAST_BATCH_SIZE: 10,
  BROADCAST_DELAY_MS: 200,
  WORKER_CONCURRENCY: 5,
  MAX_COMMANDS_PER_MINUTE: 30,
  MAX_QUEUE_SIZE: 1000,
  MAX_FILE_SIZE_MB: 50,
  SESSION_HISTORY_LIMIT: 20,
  WEBSOCKET_RECONNECT_DELAY_MS: 5000,
  MAX_RECONNECT_ATTEMPTS: 10,
} as const;

export const OLLAMA = {
  DEFAULT_MODEL: 'llama3:8b',
  VISION_MODEL: 'llava:13b',
  MAX_TOKENS: 2048,
  TEMPERATURE: 0.7,
} as const;

export const RATE_LIMITS = {
  COMMANDS_PER_MINUTE: 30,
  API_REQUESTS_PER_DAY: 100,
  BROADCASTS_PER_HOUR: 10,
  MEDIA_GENERATION_PER_DAY: 50,
} as const;

export const ERROR_MESSAGES = {
  DEVICE_NOT_FOUND: 'Dispositivo não encontrado',
  DEVICE_OFFLINE: 'Dispositivo está offline',
  INVALID_COMMAND: 'Comando inválido',
  RATE_LIMIT_EXCEEDED: 'Limite de requisições excedido',
  QUEUE_FULL: 'Fila está cheia. Tente novamente mais tarde',
  AI_SERVICE_ERROR: 'Erro ao processar com IA',
  UNAUTHORIZED: 'Não autorizado',
  SESSION_EXPIRED: 'Sessão expirada',
} as const;

export const TOOL_NAMES = {
  SEND_DEVICE_COMMAND: 'send_device_command',
  LIST_DEVICES: 'list_devices',
  LIST_GROUPS: 'list_groups',
  SCHEDULE_TASK: 'schedule_task',
  GENERATE_IMAGE: 'generate_image',
  GENERATE_VIDEO: 'generate_video',
  GET_DEVICE_STATUS: 'get_device_status',
  BROADCAST_COMMAND: 'broadcast_command',
  CREATE_CAMPAIGN: 'create_campaign',
} as const;
