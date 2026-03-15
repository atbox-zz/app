import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req) {
    const user = await this.usersService.findById(req.user.id);
    const { passwordHash, ...safe } = user;
    return safe;
  }

  @UseGuards(JwtAuthGuard)
  @Get('leaderboard')
  leaderboard() {
    return this.usersService.leaderboard();
  }

  @UseGuards(JwtAuthGuard)
  @Get('online')
  online() {
    return this.usersService.onlinePlayers();
  }
}
