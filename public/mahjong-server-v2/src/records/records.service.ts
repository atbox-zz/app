import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameRecord } from './game-record.entity';
import { UsersService } from '../users/users.service';

export interface SaveRecordDto {
  playerId: number;
  mode?: 'solo' | 'online';
  result: 'win' | 'loss' | 'draw';
  chipDelta: number;
  rounds?: number;
  winType?: string;
  winFan?: number;
  opponents?: string[];
  durationSeconds?: number;
}

@Injectable()
export class RecordsService {
  constructor(
    @InjectRepository(GameRecord) private repo: Repository<GameRecord>,
    private usersService: UsersService,
  ) {}

  async save(dto: SaveRecordDto): Promise<GameRecord> {
    const record = this.repo.create({
      playerId: dto.playerId,
      mode: dto.mode ?? 'solo',
      result: dto.result,
      chipDelta: dto.chipDelta,
      rounds: dto.rounds ?? 0,
      winType: dto.winType,
      winFan: dto.winFan ?? 0,
      opponents: dto.opponents ? JSON.stringify(dto.opponents) : null,
      durationSeconds: dto.durationSeconds ?? 0,
    });
    const saved = await this.repo.save(record);

    // Update user stats
    await this.usersService.updateStats(dto.playerId, dto.result, dto.chipDelta);

    return saved;
  }

  async findByPlayer(playerId: number, limit = 20): Promise<GameRecord[]> {
    return this.repo.find({
      where: { playerId },
      order: { playedAt: 'DESC' },
      take: limit,
    });
  }

  async playerStats(playerId: number) {
    const records = await this.repo.find({ where: { playerId } });
    const wins   = records.filter(r => r.result === 'win').length;
    const losses = records.filter(r => r.result === 'loss').length;
    const draws  = records.filter(r => r.result === 'draw').length;
    const totalChips = records.reduce((s, r) => s + r.chipDelta, 0);
    const winRate = records.length ? Math.round(wins / records.length * 100) : 0;
    const bestWin = records.filter(r=>r.result==='win').sort((a,b)=>b.chipDelta-a.chipDelta)[0];
    return { wins, losses, draws, totalChips, winRate, totalGames: records.length, bestWin };
  }
}
