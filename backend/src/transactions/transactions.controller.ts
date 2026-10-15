import { Body, Controller, Get, HttpCode, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ParseBigIntPipe } from '../common/helpers';
import { GAME_ID_RE } from './game-id';
import { TransactionsService } from './transactions.service';

class CreateTransactionDto {
  @IsInt() @Min(1) topupStockId!: number;
  @IsString() @Matches(GAME_ID_RE, { message: 'ID game tidak valid' }) gameUserId!: string;
  @IsInt() @Min(1) paymentId!: number;
}
class ConfirmDto {
  @IsOptional() @IsString() @MaxLength(100) paymentRef?: string;
  @IsOptional() @IsString() @MaxLength(400_000) proofImage?: string;
}

@Controller('transactions')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class TransactionsController {
  constructor(private txs: TransactionsService) {}

  @Get('mine') @SkipThrottle()
  mine(@Request() req: any, @Query('page') page?: string, @Query('filter') filter?: string) { return this.txs.mine(BigInt(req.user.sub), page, filter); }

  @Get(':id') @SkipThrottle()
  detail(@Request() req: any, @Param('id', ParseBigIntPipe) id: bigint) { return this.txs.detail(BigInt(req.user.sub), id); }

  @Get(':id/proof') @SkipThrottle()
  proof(@Request() req: any, @Param('id', ParseBigIntPipe) id: bigint) { return this.txs.proof(BigInt(req.user.sub), id); }

  @Post()
  create(@Request() req: any, @Body() dto: CreateTransactionDto) { return this.txs.create(BigInt(req.user.sub), dto); }

  @Post(':id/confirm-payment')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  confirm(@Request() req: any, @Param('id', ParseBigIntPipe) id: bigint, @Body() dto: ConfirmDto) {
    return this.txs.confirmPayment(BigInt(req.user.sub), id, dto.paymentRef, dto.proofImage);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Request() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.txs.close(id, 'CANCELLED', ['PENDING'], { userId: BigInt(req.user.sub) });
  }
}
