import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('invitations')
export class Invitation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column() fromId: number;
  @Column() fromName: string;
  @Column() toId: number;

  @Column({ default: 'pending' })
  status: 'pending' | 'accepted' | 'declined' | 'expired';

  @Column({ nullable: true })
  gameRoomId: string;

  @CreateDateColumn()
  createdAt: Date;
}
