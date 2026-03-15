import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(username: string, password: string, displayName?: string) {
    const user = await this.usersService.register(username, password, displayName);
    return this.issueToken(user.id, user.username, user.displayName);
  }

  async login(username: string, password: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) throw new UnauthorizedException('帳號或密碼錯誤');
    const valid = await this.usersService.validatePassword(user, password);
    if (!valid) throw new UnauthorizedException('帳號或密碼錯誤');
    await this.usersService.updateStatus(user.id, 'online');
    return this.issueToken(user.id, user.username, user.displayName);
  }

  private issueToken(id: number, username: string, displayName: string) {
    const payload = { sub: id, username, displayName };
    return {
      access_token: this.jwtService.sign(payload),
      user: { id, username, displayName },
    };
  }

  async logout(userId: number) {
    await this.usersService.updateStatus(userId, 'offline');
    return { message: '已登出' };
  }
}
