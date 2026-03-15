import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from './chat-message.entity';
import { Invitation } from './invitation.entity';
import { UsersService } from '../users/users.service';

interface AuthSocket extends Socket {
  user?: { id: number; username: string; displayName: string };
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  // socketId → user mapping
  private connected = new Map<string, { id: number; displayName: string }>();

  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    @InjectRepository(ChatMessage) private msgRepo: Repository<ChatMessage>,
    @InjectRepository(Invitation) private invRepo: Repository<Invitation>,
  ) {}

  /* ── Connection / Auth ──────────────────────────── */
  async handleConnection(socket: AuthSocket) {
    const token = socket.handshake.auth?.token ?? socket.handshake.query?.token;
    if (!token) { socket.disconnect(); return; }

    try {
      const payload = this.jwtService.verify(token as string);
      socket.user = { id: payload.sub, username: payload.username, displayName: payload.displayName };
      this.connected.set(socket.id, { id: payload.sub, displayName: payload.displayName });

      // Join personal room (for DMs and invites)
      socket.join(`user:${payload.sub}`);
      socket.join('lobby');

      await this.usersService.updateStatus(payload.sub, 'online');

      // Notify lobby of new player
      this.server.to('lobby').emit('user:joined', {
        id: payload.sub,
        displayName: payload.displayName,
      });

      // Send last 30 lobby messages to new joiner
      const history = await this.msgRepo.find({
        where: { room: 'lobby' },
        order: { sentAt: 'DESC' },
        take: 30,
      });
      socket.emit('chat:history', history.reverse());

      // Send online list
      const online = await this.usersService.onlinePlayers();
      socket.emit('users:online', online);

    } catch {
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: AuthSocket) {
    const user = this.connected.get(socket.id);
    if (user) {
      this.connected.delete(socket.id);
      await this.usersService.updateStatus(user.id, 'offline');
      this.server.to('lobby').emit('user:left', { id: user.id, displayName: user.displayName });
    }
  }

  /* ── Lobby Chat ─────────────────────────────────── */
  @SubscribeMessage('chat:lobby')
  async lobbyMessage(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() body: { content: string },
  ) {
    if (!socket.user || !body.content?.trim()) return;
    const content = body.content.slice(0, 200).trim();

    const msg = await this.msgRepo.save(this.msgRepo.create({
      senderId: socket.user.id,
      senderName: socket.user.displayName,
      room: 'lobby',
      content,
    }));

    this.server.to('lobby').emit('chat:message', {
      id: msg.id,
      senderId: msg.senderId,
      senderName: msg.senderName,
      content: msg.content,
      sentAt: msg.sentAt,
      room: 'lobby',
    });
  }

  /* ── Private DM ─────────────────────────────────── */
  @SubscribeMessage('chat:dm')
  async directMessage(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() body: { toId: number; content: string },
  ) {
    if (!socket.user || !body.content?.trim()) return;
    const content = body.content.slice(0, 200).trim();

    const msg = await this.msgRepo.save(this.msgRepo.create({
      senderId: socket.user.id,
      senderName: socket.user.displayName,
      targetId: body.toId,
      room: `dm:${Math.min(socket.user.id, body.toId)}:${Math.max(socket.user.id, body.toId)}`,
      content,
    }));

    const payload = {
      id: msg.id,
      senderId: msg.senderId,
      senderName: msg.senderName,
      content: msg.content,
      sentAt: msg.sentAt,
      room: 'dm',
    };

    // Send to both sender and receiver
    socket.emit('chat:dm', payload);
    this.server.to(`user:${body.toId}`).emit('chat:dm', payload);
  }

  /* ── Invite ─────────────────────────────────────── */
  @SubscribeMessage('invite:send')
  async sendInvite(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() body: { toId: number },
  ) {
    if (!socket.user) return;

    const inv = await this.invRepo.save(this.invRepo.create({
      fromId: socket.user.id,
      fromName: socket.user.displayName,
      toId: body.toId,
      status: 'pending',
      gameRoomId: `room:${socket.user.id}:${Date.now()}`,
    }));

    // Notify target player
    this.server.to(`user:${body.toId}`).emit('invite:received', {
      id: inv.id,
      fromId: inv.fromId,
      fromName: inv.fromName,
      gameRoomId: inv.gameRoomId,
    });

    socket.emit('invite:sent', { id: inv.id, gameRoomId: inv.gameRoomId });
  }

  @SubscribeMessage('invite:respond')
  async respondInvite(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() body: { inviteId: number; accept: boolean },
  ) {
    if (!socket.user) return;

    const inv = await this.invRepo.findOne({ where: { id: body.inviteId } });
    if (!inv || inv.toId !== socket.user.id) return;

    inv.status = body.accept ? 'accepted' : 'declined';
    await this.invRepo.save(inv);

    const event = body.accept ? 'invite:accepted' : 'invite:declined';
    const payload = {
      inviteId: inv.id,
      fromId: inv.fromId,
      toId: inv.toId,
      gameRoomId: inv.gameRoomId,
      respondedBy: socket.user.displayName,
    };

    this.server.to(`user:${inv.fromId}`).emit(event, payload);
    socket.emit(event, payload);

    if (body.accept) {
      // Both join game room
      socket.join(inv.gameRoomId);
      this.server.to(`user:${inv.fromId}`).emit('game:start', { gameRoomId: inv.gameRoomId });
    }
  }

  /* ── Typing indicator ───────────────────────────── */
  @SubscribeMessage('chat:typing')
  handleTyping(@ConnectedSocket() socket: AuthSocket) {
    if (!socket.user) return;
    socket.to('lobby').emit('chat:typing', { displayName: socket.user.displayName });
  }
}
