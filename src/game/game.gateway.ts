import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsResponse,
} from '@nestjs/websockets';
import { Server } from 'ws';
import { Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway()
export class GameGateway
  implements OnGatewayConnection, OnGatewayInit, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('MessageGateway');

  @SubscribeMessage('msgToServer')
  public handleMessage(client: Socket, payload: any): Promise<WsResponse<any>> {
    return this.server.to(payload.room).emit('msgToClient', payload);
  }

  @SubscribeMessage('joinRoom')
  public joinRoom(client: Socket, @MessageBody() room: string): void {
    client.join(room);
    client.emit('joinedRoom', room);
  }

  @SubscribeMessage('leaveRoom')
  public leaveRoom(client: Socket, @MessageBody() room: string): void {
    client.leave(room);
    client.emit('leftRoom', room);
  }

  public afterInit(server: Server): void {
    return this.logger.log('Init');
  }

  public handleDisconnect(client: Socket): void {
    return this.logger.log(`Client disconnected: ${client.id}`);
  }

  public handleConnection(client: Socket): void {
    return this.logger.log(`Client connected: ${client.id}`);
  }
}
