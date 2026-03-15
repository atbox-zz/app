import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { GameRecord } from '../records/game-record.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 30 })
  username: string;

  @Column()
  passwordHash: string;

  @Column({ default: '玩家' })
  displayName: string;

  @Column({ default: 10000 })
  chips: number; // starting chips (台幣點數)

  @Column({ default: 0 }) wins: number;
  @Column({ default: 0 }) losses: number;
  @Column({ default: 0 }) draws: number; // ryukyoku

  @Column({ default: 'online' })
  status: 'online' | 'offline' | 'playing';

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @OneToMany(() => GameRecord, r => r.player)
  records: GameRecord[];
}
