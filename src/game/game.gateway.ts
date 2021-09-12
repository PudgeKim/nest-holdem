import {
  ConnectedSocket,
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

@WebSocketGateway({ namespace: 'holdem-room', cors: true })
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
  public joinRoom(
    @MessageBody() room: string,
    @ConnectedSocket() client: Socket,
  ): void {
    client.join(room);
    client.emit('joinedRoom', room);
    console.log('joinRoom Method called');
  }

  @SubscribeMessage('leaveRoom')
  public leaveRoom(
    @MessageBody() room: string,
    @ConnectedSocket() client: Socket,
  ): void {
    client.leave(room);
    client.emit('leftRoom', room);
  }

  public afterInit(server: Server): void {
    return this.logger.log('Init');
  }

  public handleDisconnect(@ConnectedSocket() client: Socket): void {
    return this.logger.log(`Client disconnected: ${client.id}`);
  }

  public handleConnection(@ConnectedSocket() client: Socket): void {
    return this.logger.log(`Client connected: ${client.id}`);
  }
}
