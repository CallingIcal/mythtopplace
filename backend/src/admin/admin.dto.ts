import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateGameDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @Matches(/^[a-z0-9-]{2,120}$/, { message: 'Slug hanya huruf kecil, angka, dan tanda hubung' }) slug!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}
export class UpdateGameDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}
export class DiscountDto {
  @IsInt() @Min(0) @Max(90) percent!: number;
}
export class CreateStockDto {
  @Matches(/^\d{1,18}$/) gameId!: string;
  @IsString() @MinLength(1) @MaxLength(50) quantity!: string;
  @IsInt() @Min(0) @Max(1_000_000) stock!: number;
  @IsNumber() @Min(1) @Max(99_999_999) price!: number;
  @IsOptional() @IsInt() @Min(0) @Max(90) discountPercent?: number;
}
export class UpdateStockDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50) quantity?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) stock?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(99_999_999) price?: number;
  @IsOptional() @IsInt() @Min(0) @Max(90) discountPercent?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
