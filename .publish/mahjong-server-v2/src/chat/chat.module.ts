import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMessage } from './chat-message.entity';
import { Invitation } from './invitation.entity';
import { ChatGateway } from './chat.gateway';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage, Invitation]),
    UsersModule,
  ],
  providers: [ChatGateway],
})
export class ChatModule {}
