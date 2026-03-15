import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private repo: Repository<User>,
  ) {}

  async register(username: string, password: string, displayName?: string): Promise<User> {
    const exists = await this.repo.findOne({ where: { username } });
    if (exists) throw new ConflictException('用戶名已被使用');
    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.repo.create({
      username,
      passwordHash,
      displayName: displayName ?? username,
    });
    return this.repo.save(user);
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.repo.findOne({ where: { username } });
  }

  async findById(id: number): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async updateStatus(id: number, status: User['status']) {
    await this.repo.update(id, { status });
  }

  async updateStats(id: number, result: 'win' | 'loss' | 'draw', chipDelta: number) {
    const user = await this.findById(id);
    if (!user) return;
    const patch: Partial<User> = { chips: user.chips + chipDelta };
    if (result === 'win')  patch.wins   = user.wins + 1;
    if (result === 'loss') patch.losses = user.losses + 1;
    if (result === 'draw') patch.draws  = user.draws + 1;
    await this.repo.update(id, patch);
  }

  // Leaderboard: top 20 by wins
  async leaderboard(): Promise<Partial<User>[]> {
    return this.repo.find({
      select: ['id', 'displayName', 'wins', 'losses', 'chips'],
      order: { wins: 'DESC' },
      take: 20,
    });
  }

  // Online players list (for lobby)
  async onlinePlayers(): Promise<Partial<User>[]> {
    return this.repo.find({
      select: ['id', 'displayName', 'status', 'wins'],
      where: [{ status: 'online' }, { status: 'playing' }],
      order: { wins: 'DESC' },
    });
  }
}
