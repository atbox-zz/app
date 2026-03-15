import { Controller, Get, Post, Body, Param, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { IsString, IsNumber, IsOptional, IsArray, IsIn } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RecordsService } from './records.service';

class SaveRecordDto {
  @IsIn(['solo','online']) @IsOptional() mode?: 'solo' | 'online';
  @IsIn(['win','loss','draw']) result: 'win' | 'loss' | 'draw';
  @IsNumber() chipDelta: number;
  @IsNumber() @IsOptional() rounds?: number;
  @IsString() @IsOptional() winType?: string;
  @IsNumber() @IsOptional() winFan?: number;
  @IsArray() @IsOptional() opponents?: string[];
  @IsNumber() @IsOptional() durationSeconds?: number;
}

@Controller('records')
@UseGuards(JwtAuthGuard)
export class RecordsController {
  constructor(private recordsService: RecordsService) {}

  @Post()
  save(@Request() req, @Body() dto: SaveRecordDto) {
    return this.recordsService.save({ ...dto, playerId: req.user.id });
  }

  @Get('my')
  myRecords(@Request() req) {
    return this.recordsService.findByPlayer(req.user.id);
  }

  @Get('my/stats')
  myStats(@Request() req) {
    return this.recordsService.playerStats(req.user.id);
  }

  @Get('player/:id')
  playerRecords(@Param('id', ParseIntPipe) id: number) {
    return this.recordsService.findByPlayer(id);
  }
}
