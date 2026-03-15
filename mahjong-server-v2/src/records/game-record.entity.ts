import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('game_records')
export class GameRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, u => u.records, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playerId' })
  player: User;

  @Column()
  playerId: number;

  // Game summary
  @Column({ default: 'solo' })
  mode: 'solo' | 'online'; // solo = vs AI, online = multiplayer

  @Column()
  result: 'win' | 'loss' | 'draw';

  @Column({ default: 0 })
  chipDelta: number; // +/- points this game

  @Column({ default: 0 })
  rounds: number;

  // Win detail
  @Column({ nullable: true })
  winType: string; // 清一色, 七對, etc.

  @Column({ default: 0 })
  winFan: number;

  // Opponents (JSON array of displayNames)
  @Column({ nullable: true })
  opponents: string; // JSON

  @Column({ default: 0 })
  durationSeconds: number;

  @CreateDateColumn()
  playedAt: Date;
}
