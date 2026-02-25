export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (params: any, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  userId: string;
  sessionId?: string;
  prisma: any;
  redis: any;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getToolDescriptions(): any[] {
    return this.getAllTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  private registerDefaultTools() {
    // Tool: list_devices
    this.register({
      name: 'list_devices',
      description: 'Lista todos os dispositivos disponíveis',
      parameters: {
        type: 'object',
        properties: {
          groupId: { type: 'string', description: 'ID do grupo (opcional)' },
          status: { type: 'string', description: 'Status do dispositivo (opcional)' },
        },
        required: [],
      },
      execute: async (params, context) => {
        try {
          const devices = await context.prisma.device.findMany({
            where: {
              ...(params.groupId && { groupId: params.groupId }),
              ...(params.status && { status: params.status }),
            },
            include: { group: true },
          });
          return { success: true, data: { devices } };
        } catch (error) {
          return { success: false, error: 'Erro ao listar dispositivos' };
        }
      },
    });

    // Tool: send_device_command
    this.register({
      name: 'send_device_command',
      description: 'Envia um comando para um ou mais dispositivos',
      parameters: {
        type: 'object',
        properties: {
          targetType: { type: 'string', enum: ['DEVICE', 'GROUP', 'ALL'], description: 'Tipo de alvo' },
          targetDeviceId: { type: 'string', description: 'ID do dispositivo (se targetType=DEVICE)' },
          targetGroupId: { type: 'string', description: 'ID do grupo (se targetType=GROUP)' },
          commandName: { type: 'string', description: 'Nome do comando' },
          params: { type: 'object', description: 'Parâmetros do comando' },
        },
        required: ['targetType', 'commandName'],
      },
      execute: async (params, context) => {
        try {
          // Criar comando no banco
          const command = await context.prisma.command.create({
            data: {
              type: params.targetType === 'DEVICE' ? 'SINGLE' : 'BROADCAST',
              targetType: params.targetType,
              targetDeviceId: params.targetDeviceId,
              targetGroupId: params.targetGroupId,
              commandName: params.commandName,
              params: params.params || {},
              status: 'QUEUED',
              createdBy: context.userId,
            },
          });
          return { success: true, data: { command } };
        } catch (error) {
          return { success: false, error: 'Erro ao criar comando' };
        }
      },
    });

    // Tool: schedule_task
    this.register({
      name: 'schedule_task',
      description: 'Agenda uma tarefa para execução futura',
      parameters: {
        type: 'object',
        properties: {
          commandName: { type: 'string', description: 'Nome do comando' },
          params: { type: 'object', description: 'Parâmetros do comando' },
          targetType: { type: 'string', enum: ['DEVICE', 'GROUP', 'ALL'] },
          targetId: { type: 'string', description: 'ID do alvo' },
          scheduledAt: { type: 'string', description: 'Data/hora ISO' },
        },
        required: ['commandName', 'scheduledAt', 'targetType'],
      },
      execute: async (params, context) => {
        try {
          const command = await context.prisma.command.create({
            data: {
              type: 'SCHEDULED',
              targetType: params.targetType,
              targetDeviceId: params.targetType === 'DEVICE' ? params.targetId : null,
              targetGroupId: params.targetType === 'GROUP' ? params.targetId : null,
              commandName: params.commandName,
              params: params.params || {},
              status: 'PENDING',
              scheduledAt: new Date(params.scheduledAt),
              createdBy: context.userId,
            },
          });
          return { success: true, data: { command } };
        } catch (error) {
          return { success: false, error: 'Erro ao agendar tarefa' };
        }
      },
    });

    // Tool: get_device_status
    this.register({
      name: 'get_device_status',
      description: 'Obtém o status de um dispositivo específico',
      parameters: {
        type: 'object',
        properties: {
          deviceId: { type: 'string', description: 'ID do dispositivo' },
        },
        required: ['deviceId'],
      },
      execute: async (params, context) => {
        try {
          const device = await context.prisma.device.findUnique({
            where: { id: params.deviceId },
            include: { group: true },
          });
          if (!device) {
            return { success: false, error: 'Dispositivo não encontrado' };
          }
          return { success: true, data: { device } };
        } catch (error) {
          return { success: false, error: 'Erro ao obter status' };
        }
      },
    });

    // Tool: list_groups
    this.register({
      name: 'list_groups',
      description: 'Lista todos os grupos de dispositivos',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async (params, context) => {
        try {
          const groups = await context.prisma.deviceGroup.findMany({
            include: {
              devices: { select: { id: true, name: true, status: true } },
            },
          });
          return { success: true, data: { groups } };
        } catch (error) {
          return { success: false, error: 'Erro ao listar grupos' };
        }
      },
    });
  }
}
