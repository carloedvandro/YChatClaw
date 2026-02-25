export interface Device {
  id: string;
  uuid: string;
  name?: string;
  status: DeviceStatus;
  lastHeartbeat?: Date;
  metadata?: Record<string, any>;
  groupId?: string;
  group?: DeviceGroup;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceGroup {
  id: string;
  name: string;
  description?: string;
  devices: Device[];
  createdAt: Date;
}

export interface User {
  id: string;
  channelType: ChannelType;
  externalId: string;
  name?: string;
  preferences: Record<string, any>;
  rateLimits: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  user: User;
  channelType: ChannelType;
  channelId: string;
  history: SessionMessage[];
  context: Record<string, any>;
  lastActivity: Date;
  createdAt: Date;
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, any>;
  result?: any;
}

export interface Command {
  id: string;
  type: CommandType;
  targetType?: TargetType;
  targetDeviceId?: string;
  targetGroupId?: string;
  commandName: string;
  params: Record<string, any>;
  status: CommandStatus;
  result?: Record<string, any>;
  error?: string;
  scheduledAt?: Date;
  executedAt?: Date;
  retryCount: number;
  createdAt: Date;
  createdBy: string;
  device?: Device;
  user: User;
}

export interface Media {
  id: string;
  userId: string;
  user: User;
  filename: string;
  path: string;
  type: MediaType;
  size: number;
  metadata: Record<string, any>;
  campaignId?: string;
  campaign?: Campaign;
  createdAt: Date;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  scheduleConfig: CampaignScheduleConfig;
  targetGroupId?: string;
  isActive: boolean;
  createdBy: string;
  user: User;
  media: Media[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignScheduleConfig {
  type: 'once' | 'recurring' | 'random';
  cronExpression?: string;
  startDate?: string;
  endDate?: string;
  randomIntervalMinutes?: number;
}

export interface ApiKey {
  id: string;
  userId: string;
  user: User;
  provider: string;
  keyEncrypted: string;
  limits: ApiLimits;
  usageStats: ApiUsageStats;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiLimits {
  requestsPerDay: number;
  timeoutMs: number;
  maxRetries: number;
}

export interface ApiUsageStats {
  requestsToday: number;
  lastRequestAt?: Date;
  totalRequests: number;
}

export enum DeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  BUSY = 'BUSY',
  ERROR = 'ERROR',
}

export enum ChannelType {
  WHATSAPP = 'whatsapp',
  TELEGRAM = 'telegram',
  DISCORD = 'discord',
}

export enum CommandType {
  SINGLE = 'SINGLE',
  BROADCAST = 'BROADCAST',
  SCHEDULED = 'SCHEDULED',
}

export enum TargetType {
  DEVICE = 'DEVICE',
  GROUP = 'GROUP',
  ALL = 'ALL',
}

export enum CommandStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
}
