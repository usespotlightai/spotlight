import { ApiProperty } from '@nestjs/swagger';

export class MoneyResponseDto {
  @ApiProperty({ example: 3.2 })
  readonly amount: number;

  @ApiProperty({ example: 'USD' })
  readonly currency: string;

  constructor(spend: { readonly amount: number; readonly currency: string }) {
    this.amount = spend.amount;
    this.currency = spend.currency;
  }
}
