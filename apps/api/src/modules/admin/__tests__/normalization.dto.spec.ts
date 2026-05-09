import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { describe, expect, it } from 'vitest';
import { validateSync } from 'class-validator';
import { CreateNormalizationAliasDto, CreateNormalizationTermDto } from '../dto/normalization.dto';

describe('normalization dto', () => {
  it('标准词 DTO 会拦截非法 domain', () => {
    const dto = plainToInstance(CreateNormalizationTermDto, {
      domain: 'INVALID_DOMAIN',
      canonicalName: '测试词',
    });

    const errors = validateSync(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.constraints).toBeTruthy();
  });

  it('标准词 DTO 能接收合法地点词并完成数字字段转换', () => {
    const dto = plainToInstance(CreateNormalizationTermDto, {
      domain: 'LOCATION',
      canonicalName: '济南',
      level: 'city',
      sortOrder: '12',
      status: 'active',
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
    expect(dto.sortOrder).toBe(12);
  });

  it('别名 DTO 会拦截非法匹配方式', () => {
    const dto = plainToInstance(CreateNormalizationAliasDto, {
      aliasName: '中烟',
      matchMode: 'regexp',
    });

    const errors = validateSync(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
