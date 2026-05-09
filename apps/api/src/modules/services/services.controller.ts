import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';

@ApiTags('service-products')
@Controller('service-products')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  getList() {
    return this.servicesService.getList();
  }

  @Get(':id')
  getDetail(@Param('id') id: string) {
    return this.servicesService.getDetail(id);
  }
}
