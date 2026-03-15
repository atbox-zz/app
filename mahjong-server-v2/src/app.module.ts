import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { join } from 'path';

import { User } from './users/user.entity';
import { GameRecord } from './records/game-record.entity';
import { ChatMessage } from './chat/chat-message.entity';
import { Invitation } from './chat/invitation.entity';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RecordsModule } from './records/records.module';
import { ChatModule } from './chat/chat.module';

const JWT_SECRET = process.env.JWT_SECRET ?? 'mahjong_dev_secret';

@Module({
  imports: [
    // SQLite — sql.js (純 JS，Windows 免編譯)
    TypeOrmModule.forRoot({
      type: 'sqljs',
      location: process.env.DB_PATH ?? 'mahjong',
      autoSave: true,
      useLocalForage: false,
      entities: [User, GameRecord, ChatMessage, Invitation],
      synchronize: true,
      logging: false,
    }),

    // Global JWT config
    JwtModule.register({
      global: true,
      secret: JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' },
    }),

    PassportModule,
    UsersModule,
    AuthModule,
    RecordsModule,
    ChatModule,
  ],
})
export class AppModule {}
