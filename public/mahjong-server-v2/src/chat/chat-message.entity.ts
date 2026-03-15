import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  senderId: number;

  @Column()
  senderName: string;

  // null = lobby broadcast, otherwise target user id
  @Column({ nullable: true })
  targetId: number;

  @Column({ default: 'lobby' })
  room: string; // 'lobby' | 'dm:userId'

  @Column({ length: 500 })
  content: string;

  @CreateDateColumn()
  sentAt: Date;
}
